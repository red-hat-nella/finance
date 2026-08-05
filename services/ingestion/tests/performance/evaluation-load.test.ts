import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../src/config/schema.js";
import type { ActorContext } from "../../src/domain/authorization/policies.js";
import type { ScoreCommand, ScoringClient, ScoringResponse } from "../../src/infrastructure/scoring/scoring-client.js";
import { ApplicationRepository } from "../../src/modules/applications/application.repository.js";
import { ApplicationService } from "../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../src/modules/audit/audit-writer.js";
import { EvaluateApplicationService } from "../../src/modules/evaluations/evaluate-application.service.js";
import { EvaluationRepository } from "../../src/modules/evaluations/evaluation.repository.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const actor: ActorContext = { actorId: randomUUID(), orgId: randomUUID(), roles: ["credit_analyst"] };
const config = configSchema.parse({
  nodeEnv: "test", port: 8080,
  database: { host: "localhost", port: 5432, name: "alternative_scoring", user: "postgres", password: "integration-password", sslMode: "disable" },
  scoring: { baseUrl: "http://scoring", timeoutMs: 750, criteriaVersion: "SCORING-MVP-1.0.0", token: "s".repeat(32) },
  auth: { issuer: "http://auth", audience: "alternative-credit-scoring", jwksUrl: "http://auth/jwks", algorithms: ["RS256"] },
  pii: { encryptionKey: Buffer.alloc(32, 71), hmacKey: Buffer.alloc(32, 72), keyVersion: 1 },
  corsAllowedOrigins: [], logLevel: "error",
});
const checksum = "b1e1f281dbe194430c53cd18ce85400ee217999a92e83a27ace2d1101c4e8eff";
let pool: pg.Pool;

describeDatabase("performance: 20 concurrent evaluations", () => {
  beforeAll(() => { pool = new pg.Pool({ connectionString: databaseUrl, max: 30 }); });
  afterAll(async () => { await pool.end(); });

  it("keeps evaluation orchestration p95 below 2 seconds", async () => {
    const applications = new ApplicationService(pool, new ApplicationRepository(pool, config), new PostgresAuditWriter(pool));
    const scorer = { calculate: (command: ScoreCommand) => Promise.resolve({ response: score(command), criteriaChecksum: checksum }) } as ScoringClient;
    const evaluations = new EvaluateApplicationService(pool, new EvaluationRepository(pool), new PostgresAuditWriter(pool), config, scorer);
    const fixture = JSON.parse(readFileSync("../../tests/fixtures/medium-risk-application.json", "utf8")) as Record<string, unknown>;
    const drafts = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
      const input = structuredClone(fixture);
      (input["applicant"] as Record<string, unknown>)["documentNumber"] = `PERF${String(index).padStart(4, "0")}`;
      return applications.create(input, actor, randomUUID(), randomUUID());
    }));
    const durations: number[] = [];
    const results = await Promise.all(drafts.map(async (draft) => {
      const started = performance.now();
      const result = await evaluations.execute(draft.body.applicationId, { revisionNumber: 1, expectedCriteriaVersion: "SCORING-MVP-1.0.0" }, draft.etag, randomUUID(), actor, randomUUID());
      durations.push(performance.now() - started);
      return result;
    }));
    const p95 = durations.sort((a, b) => a - b)[Math.ceil(durations.length * 0.95) - 1] ?? Infinity;
    expect(results).toHaveLength(20);
    expect(results.every((result) => result.body["score"] === 634)).toBe(true);
    expect(p95).toBeLessThan(2_000);
    console.info(`evaluation_concurrency=20 p95_ms=${p95.toFixed(1)}`);
  });
});

function score(command: ScoreCommand): ScoringResponse {
  return {
    resultType: "scored", evaluationId: command.evaluationId, status: "revision_manual", score: 634,
    scoreScale: { minimum: 300, maximum: 850 }, riskBand: "riesgo_medio",
    recommendation: { code: "MANUAL_REVIEW_REQUIRED", text: "Realizar revisión manual obligatoria." },
    factors: (["utility", "income", "mobile"] as const).map((dimension, index) => ({
      rank: index + 1, dimension, direction: "favorable", dimensionIndex: "60.000",
      weight: dimension === "utility" ? "0.400" : "0.300", contributionPoints: "100.000",
      observedSummary: `Resumen ${dimension}.`, ruleCode: `${dimension.toUpperCase()}_PERF`, explanation: `Aporte ${dimension}.`,
    })),
    manualReviewReasons: [{ code: "MEDIUM_RISK_BAND", dimension: "explanation", message: "Revisión humana requerida." }],
    criteriaVersion: "SCORING-MVP-1.0.0", inputHash: command.inputHash, calculatedAt: new Date().toISOString(),
  };
}
