import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { configSchema } from "../../../src/config/schema.js";
import type { ActorContext } from "../../../src/domain/authorization/policies.js";
import type {
  ScoreCommand,
  ScoringClient,
  ScoringResponse,
} from "../../../src/infrastructure/scoring/scoring-client.js";
import { ApplicationRepository } from "../../../src/modules/applications/application.repository.js";
import { ApplicationService } from "../../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../../src/modules/audit/audit-writer.js";
import { EvaluateApplicationService } from "../../../src/modules/evaluations/evaluate-application.service.js";
import { EvaluationRepository } from "../../../src/modules/evaluations/evaluation.repository.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const checksum = "b1e1f281dbe194430c53cd18ce85400ee217999a92e83a27ace2d1101c4e8eff";
const actor: ActorContext = {
  actorId: `analyst-evaluation-${randomUUID()}`,
  orgId: `org-evaluation-${randomUUID()}`,
  roles: ["credit_analyst"],
};
const config = configSchema.parse({
  nodeEnv: "test",
  port: 8080,
  database: { host: "localhost", port: 5432, name: "alternative_scoring", user: "postgres", password: "integration-password", sslMode: "disable" },
  scoring: { baseUrl: "http://scoring:8080", timeoutMs: 750, criteriaVersion: "SCORING-MVP-1.0.0", token: "s".repeat(32) },
  auth: { issuer: "http://auth:8080", audience: "alternative-credit-scoring", jwksUrl: "http://auth:8080/jwks", algorithms: ["RS256"] },
  pii: { encryptionKey: Buffer.alloc(32, 41), hmacKey: Buffer.alloc(32, 42), keyVersion: 1 },
  corsAllowedOrigins: [],
  logLevel: "error",
});

interface Profile {
  fixture: string;
  score: number;
  status: "evaluada" | "revision_manual";
  riskBand: "riesgo_bajo" | "riesgo_medio" | "riesgo_alto";
}

const profiles: readonly Profile[] = [
  { fixture: "low-risk-application.json", score: 835, status: "evaluada", riskBand: "riesgo_bajo" },
  { fixture: "medium-risk-application.json", score: 634, status: "revision_manual", riskBand: "riesgo_medio" },
  { fixture: "high-risk-application.json", score: 385, status: "evaluada", riskBand: "riesgo_alto" },
];

let pool: pg.Pool;
let applicationService: ApplicationService;

describeDatabase("US1 PostgreSQL evaluation orchestration", () => {
  beforeAll(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    applicationService = new ApplicationService(
      pool,
      new ApplicationRepository(pool, config),
      new PostgresAuditWriter(pool),
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it.each(profiles)(
    "persists immutable two-transaction result for $riskBand",
    async (profile) => {
      const input = JSON.parse(
        readFileSync(`../../tests/fixtures/${profile.fixture}`, "utf8"),
      ) as Record<string, unknown>;
      const applicant = input["applicant"] as Record<string, unknown>;
      applicant["documentNumber"] = `8${String(Date.now()).slice(-7)}${(
        profile.score % 10
      ).toString()}`;
      const created = await applicationService.create(
        input,
        actor,
        randomUUID(),
        randomUUID(),
      );
      const calculate = vi.fn((command: ScoreCommand) =>
        Promise.resolve({
          response: responseFor(command, profile),
          criteriaChecksum: checksum,
        }),
      );
      const service = new EvaluateApplicationService(
        pool,
        new EvaluationRepository(pool),
        new PostgresAuditWriter(pool),
        config,
        { calculate } as unknown as ScoringClient,
      );
      const key = randomUUID();
      const first = await service.execute(
        created.body.applicationId,
        { revisionNumber: 1, expectedCriteriaVersion: "SCORING-MVP-1.0.0" },
        created.etag,
        key,
        actor,
        randomUUID(),
      );

      expect(first.body).toMatchObject({
        score: profile.score,
        state: profile.status,
        riskBand: profile.riskBand,
        criteriaVersion: "SCORING-MVP-1.0.0",
      });
      expect(first.body["factors"]).toHaveLength(3);
      expect(calculate).toHaveBeenCalledTimes(1);

      const replayed = await Promise.all(
        Array.from({ length: 20 }, () =>
          service.execute(
            created.body.applicationId,
            { revisionNumber: 1, expectedCriteriaVersion: "SCORING-MVP-1.0.0" },
            created.etag,
            key,
            actor,
            randomUUID(),
          ),
        ),
      );
      expect(replayed.every((item) => item.replayed)).toBe(true);
      expect(new Set(replayed.map((item) => item.body["evaluationId"])).size).toBe(1);
      expect(calculate).toHaveBeenCalledTimes(1);

      const stored = await pool.query<{
        evaluation_id: string;
        evaluation_count: string;
        factor_count: string;
        snapshot_count: string;
        active_count: string;
      }>(
        `SELECT min(e.id::text) evaluation_id,count(DISTINCT e.id)::text evaluation_count,
                count(DISTINCT f.id)::text factor_count,
                count(DISTINCT s.evaluation_id)::text snapshot_count,
                count(DISTINCT e.id) FILTER (WHERE e.status='evaluando')::text active_count
           FROM scoring.evaluations e
           JOIN scoring.application_revisions r ON r.id=e.revision_id
           JOIN scoring.applications a ON a.id=r.application_id
           LEFT JOIN scoring.evaluation_factors f ON f.evaluation_id=e.id
           LEFT JOIN scoring.evaluation_input_snapshots s ON s.evaluation_id=e.id
          WHERE a.public_id=$1`,
        [created.body.applicationId],
      );
      expect(stored.rows[0]).toMatchObject({
        evaluation_count: "1",
        factor_count: "3",
        snapshot_count: "1",
        active_count: "0",
      });
      await expect(
        pool.query(
          `UPDATE scoring.evaluation_input_snapshots
              SET normalized_input='{}'::jsonb WHERE evaluation_id=$1`,
          [stored.rows[0]?.evaluation_id],
        ),
      ).rejects.toThrow(/append-only|immutable/i);
    },
  );
});

function responseFor(command: ScoreCommand, profile: Profile): ScoringResponse {
  const weight = (dimension: string) =>
    dimension === "utility" ? "0.400" : "0.300";
  return {
    resultType: "scored",
    evaluationId: command.evaluationId,
    status: profile.status,
    score: profile.score,
    scoreScale: { minimum: 300, maximum: 850 },
    riskBand: profile.riskBand,
    recommendation: {
      code:
        profile.status === "revision_manual"
          ? "MANUAL_REVIEW_REQUIRED"
          : profile.riskBand === "riesgo_alto"
            ? "DO_NOT_CONTINUE_WITHOUT_DOCUMENTED_HUMAN_DECISION"
            : "CONTINUE_HUMAN_ANALYSIS",
      text: "Resultado para análisis humano.",
    },
    factors: (["utility", "income", "mobile"] as const).map(
      (dimension, index) => ({
        rank: index + 1,
        dimension,
        direction: profile.riskBand === "riesgo_alto" ? "unfavorable" : "favorable",
        dimensionIndex: "75.000",
        weight: weight(dimension),
        contributionPoints: dimension === "utility" ? "165.000" : "123.750",
        observedSummary: `Resumen verificable de ${dimension}.`,
        ruleCode: `${dimension.toUpperCase()}_TEST_RULE`,
        explanation: `El factor ${dimension} explica su aporte al resultado.`,
      }),
    ),
    manualReviewReasons:
      profile.status === "revision_manual"
        ? [{ code: "MEDIUM_RISK_BAND", dimension: "explanation", message: "La banda media requiere revisión manual." }]
        : [],
    criteriaVersion: "SCORING-MVP-1.0.0",
    inputHash: command.inputHash,
    calculatedAt: new Date().toISOString(),
  };
}
