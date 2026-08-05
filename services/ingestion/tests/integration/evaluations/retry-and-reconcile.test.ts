import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../../src/config/schema.js";
import type { ActorContext } from "../../../src/domain/authorization/policies.js";
import { inTransaction } from "../../../src/infrastructure/db/transaction.js";
import {
  ScoringClientError,
  type ScoreCommand,
  type ScoringClient,
  type ScoringResponse,
} from "../../../src/infrastructure/scoring/scoring-client.js";
import { ApplicationRepository } from "../../../src/modules/applications/application.repository.js";
import { ApplicationService } from "../../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../../src/modules/audit/audit-writer.js";
import { EvaluateApplicationService } from "../../../src/modules/evaluations/evaluate-application.service.js";
import { EvaluationRepository } from "../../../src/modules/evaluations/evaluation.repository.js";
import { RetryEvaluationService } from "../../../src/modules/evaluations/retry-evaluation.service.js";
import { reconcileStaleEvaluations } from "../../../src/modules/evaluations/reconcile-stale-evaluations.js";
import { buildScoringSnapshot } from "../../../src/modules/evaluations/scoring-input.builder.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const checksum = "b1e1f281dbe194430c53cd18ce85400ee217999a92e83a27ace2d1101c4e8eff";
const config = configSchema.parse({
  nodeEnv: "test",
  port: 8080,
  database: { host: "localhost", port: 5432, name: "alternative_scoring", user: "postgres", password: "integration-password", sslMode: "disable" },
  scoring: { baseUrl: "http://scoring:8080", timeoutMs: 750, criteriaVersion: "SCORING-MVP-1.0.0", token: "s".repeat(32) },
  auth: { issuer: "http://auth:8080", audience: "alternative-credit-scoring", jwksUrl: "http://auth:8080/jwks", algorithms: ["RS256"] },
  pii: { encryptionKey: Buffer.alloc(32, 51), hmacKey: Buffer.alloc(32, 52), keyVersion: 1 },
  corsAllowedOrigins: [],
  logLevel: "error",
});

let pool: pg.Pool;
let applications: ApplicationService;

describeDatabase("US2 explicit retry and correction revision", () => {
  beforeAll(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    applications = new ApplicationService(
      pool,
      new ApplicationRepository(pool, config),
      new PostgresAuditWriter(pool),
    );
  });

  afterAll(async () => pool.end());

  it("links attempt N+1, copies the exact snapshot and creates revision N+1 for corrections", async () => {
    const actor: ActorContext = {
      actorId: `analyst-retry-${randomUUID()}`,
      orgId: `org-retry-${randomUUID()}`,
      roles: ["credit_analyst"],
    };
    const input = JSON.parse(
      readFileSync("../../tests/fixtures/low-risk-application.json", "utf8"),
    ) as Record<string, unknown>;
    (input["applicant"] as Record<string, unknown>)["documentNumber"] =
      `7${String(Date.now()).slice(-8)}`;
    const created = await applications.create(input, actor, randomUUID(), randomUUID());
    const failingClient = {
      calculate: () => Promise.reject(new ScoringClientError("SCORING_TIMEOUT", 504)),
    } as unknown as ScoringClient;
    const evaluator = new EvaluateApplicationService(
      pool,
      new EvaluationRepository(pool),
      new PostgresAuditWriter(pool),
      config,
      failingClient,
    );
    let failedEvaluationId = "";
    try {
      await evaluator.execute(
        created.body.applicationId,
        { revisionNumber: 1, expectedCriteriaVersion: "SCORING-MVP-1.0.0" },
        created.etag,
        randomUUID(),
        actor,
        randomUUID(),
      );
    } catch (error) {
      failedEvaluationId = (error as { evaluationId?: string }).evaluationId ?? "";
    }
    expect(failedEvaluationId).toMatch(/^[0-9a-f-]{36}$/);

    const succeedingClient = {
      calculate: (command: ScoreCommand) =>
        Promise.resolve({ response: successfulResponse(command), criteriaChecksum: checksum }),
    } as unknown as ScoringClient;
    const retry = new RetryEvaluationService(
      pool,
      new EvaluationRepository(pool),
      new PostgresAuditWriter(pool),
      config,
      succeedingClient,
    );
    const result = await retry.execute(
      failedEvaluationId,
      randomUUID(),
      actor,
      randomUUID(),
    );
    expect(result.body).toMatchObject({
      attemptNumber: 2,
      retryOfEvaluationId: failedEvaluationId,
      state: "evaluada",
      score: 835,
    });

    const attempts = await pool.query<{
      public_id: string;
      retry_of_public_id: string | null;
      attempt_number: number;
      status: string;
      input_hash: string;
      normalized_input: unknown;
    }>(
      `SELECT e.public_id,e2.public_id retry_of_public_id,e.attempt_number,e.status,
              encode(s.input_hash,'hex') input_hash,s.normalized_input
         FROM scoring.evaluations e
         JOIN scoring.evaluation_input_snapshots s ON s.evaluation_id=e.id
         LEFT JOIN scoring.evaluations e2 ON e2.id=e.retry_of_evaluation_id
         JOIN scoring.application_revisions r ON r.id=e.revision_id
         JOIN scoring.applications a ON a.id=r.application_id
        WHERE a.public_id=$1 ORDER BY e.attempt_number`,
      [created.body.applicationId],
    );
    expect(attempts.rows).toHaveLength(2);
    expect(attempts.rows[1]).toMatchObject({
      retry_of_public_id: failedEvaluationId,
      attempt_number: 2,
      status: "evaluada",
    });
    expect(attempts.rows[1]?.input_hash).toBe(attempts.rows[0]?.input_hash);
    expect(attempts.rows[1]?.normalized_input).toEqual(attempts.rows[0]?.normalized_input);

    const current = await applications.get(created.body.applicationId, actor);
    const corrected = await applications.update(
      created.body.applicationId,
      { alternativeData: { income: { availability: "provided", monthlyIncomeCop: "4200000.00", sourceType: "employment", stabilityMonths: 60 } } },
      current.etag,
      actor,
      randomUUID(),
    );
    expect(corrected.body).toMatchObject({ state: "borrador", revisionNumber: 2, lockVersion: 1 });
    expect(corrected.body.alternativeData?.income).toMatchObject({ monthlyIncomeCop: "4200000.00" });
    expect(attempts.rows[0]?.status).toBe("error");
  });

  it("reconciles stale active attempts once with a safe operational code", async () => {
    const actor: ActorContext = {
      actorId: `analyst-reconcile-${randomUUID()}`,
      orgId: `org-reconcile-${randomUUID()}`,
      roles: ["credit_analyst"],
    };
    const input = JSON.parse(
      readFileSync("../../tests/fixtures/low-risk-application.json", "utf8"),
    ) as Record<string, unknown>;
    (input["applicant"] as Record<string, unknown>)["documentNumber"] =
      `5${String(Date.now()).slice(-8)}`;
    const created = await applications.create(input, actor, randomUUID(), randomUUID());
    const repository = new EvaluationRepository(pool);
    const evaluationId = await inTransaction(pool, async (db) => {
      const draft = await repository.lockApplicationDraft(db, created.body.applicationId, actor);
      if (!draft || !draft.alternativeData.income || !draft.alternativeData.utilities || !draft.alternativeData.mobile)
        throw new Error("Complete draft expected for reconciler test.");
      const snapshot = buildScoringSnapshot({
        income: draft.alternativeData.income,
        utilities: draft.alternativeData.utilities,
        mobile: draft.alternativeData.mobile,
      });
      const started = await repository.start(db, draft, actor, randomUUID(), randomUUID(), snapshot);
      await db.query(
        `UPDATE scoring.evaluations SET started_at=now()-interval '3 minutes' WHERE id=$1`,
        [started.id],
      );
      return started.id;
    });

    const first = await reconcileStaleEvaluations(pool, 120);
    const second = await reconcileStaleEvaluations(pool, 120);
    expect(first.lockAcquired).toBe(true);
    expect(first.reconciled).toBeGreaterThanOrEqual(1);
    expect(second).toEqual({ lockAcquired: true, reconciled: 0 });
    const stored = await pool.query<{ status: string; error_code: string; score: number | null }>(
      `SELECT status,error_code,score FROM scoring.evaluations WHERE id=$1`,
      [evaluationId],
    );
    expect(stored.rows[0]).toEqual({
      status: "error",
      error_code: "ORCHESTRATION_INTERRUPTED",
      score: null,
    });
  });
});

function successfulResponse(command: ScoreCommand): ScoringResponse {
  return {
    resultType: "scored",
    evaluationId: command.evaluationId,
    status: "evaluada",
    score: 835,
    scoreScale: { minimum: 300, maximum: 850 },
    riskBand: "riesgo_bajo",
    recommendation: { code: "CONTINUE_HUMAN_ANALYSIS", text: "Continuar con análisis humano." },
    factors: (["utility", "income", "mobile"] as const).map((dimension, index) => ({
      rank: index + 1,
      dimension,
      direction: "favorable" as const,
      dimensionIndex: "90.000",
      weight: dimension === "utility" ? "0.400" : "0.300",
      contributionPoints: dimension === "utility" ? "198.000" : "148.500",
      observedSummary: `Resumen verificable de ${dimension}.`,
      ruleCode: `${dimension.toUpperCase()}_TEST`,
      explanation: `El factor ${dimension} explica el resultado.`,
    })),
    manualReviewReasons: [],
    criteriaVersion: "SCORING-MVP-1.0.0",
    inputHash: command.inputHash,
    calculatedAt: new Date().toISOString(),
  };
}
