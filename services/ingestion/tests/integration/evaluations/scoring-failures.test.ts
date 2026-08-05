import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../../src/config/schema.js";
import type { ActorContext } from "../../../src/domain/authorization/policies.js";
import { ScoringClientError, type ScoringClient } from "../../../src/infrastructure/scoring/scoring-client.js";
import { ApplicationRepository } from "../../../src/modules/applications/application.repository.js";
import { ApplicationService } from "../../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../../src/modules/audit/audit-writer.js";
import { EvaluateApplicationService } from "../../../src/modules/evaluations/evaluate-application.service.js";
import { EvaluationRepository } from "../../../src/modules/evaluations/evaluation.repository.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const config = configSchema.parse({
  nodeEnv: "test", port: 8080,
  database: { host: "localhost", port: 5432, name: "alternative_scoring", user: "postgres", password: "integration-password", sslMode: "disable" },
  scoring: { baseUrl: "http://scoring:8080", timeoutMs: 750, criteriaVersion: "SCORING-MVP-1.0.0", token: "s".repeat(32) },
  auth: { issuer: "http://auth:8080", audience: "alternative-credit-scoring", jwksUrl: "http://auth:8080/jwks", algorithms: ["RS256"] },
  pii: { encryptionKey: Buffer.alloc(32, 61), hmacKey: Buffer.alloc(32, 62), keyVersion: 1 },
  corsAllowedOrigins: [], logLevel: "error",
});
let pool: pg.Pool;

describeDatabase("US2 scoring failure persistence", () => {
  beforeAll(() => { pool = new pg.Pool({ connectionString: databaseUrl }); });
  afterAll(async () => pool.end());

  it.each([
    ["SCORING_TIMEOUT", 504],
    ["SCORING_UNAVAILABLE", 502],
    ["SCORING_RESPONSE_INVALID", 502],
  ] as const)("persists %s without a partial result", async (code, status) => {
    const actor: ActorContext = { actorId: `analyst-failure-${randomUUID()}`, orgId: `org-failure-${randomUUID()}`, roles: ["credit_analyst"] };
    const applications = new ApplicationService(pool, new ApplicationRepository(pool, config), new PostgresAuditWriter(pool));
    const input = JSON.parse(readFileSync("../../tests/fixtures/low-risk-application.json", "utf8")) as Record<string, unknown>;
    (input["applicant"] as Record<string, unknown>)["documentNumber"] =
      `6${String(Date.now()).slice(-7)}${String(status).slice(-1)}`;
    const created = await applications.create(input, actor, randomUUID(), randomUUID());
    const client = { calculate: () => Promise.reject(new ScoringClientError(code, status)) } as unknown as ScoringClient;
    const service = new EvaluateApplicationService(pool, new EvaluationRepository(pool), new PostgresAuditWriter(pool), config, client);
    await expect(service.execute(created.body.applicationId, { revisionNumber: 1, expectedCriteriaVersion: "SCORING-MVP-1.0.0" }, created.etag, randomUUID(), actor, randomUUID())).rejects.toMatchObject({ code, status });
    const stored = await pool.query<{ status: string; score: number | null; risk_band: string | null; recommendation_code: string | null; factor_count: string }>(
      `SELECT e.status,e.score,e.risk_band,e.recommendation_code,count(f.id)::text factor_count
         FROM scoring.evaluations e
         JOIN scoring.application_revisions r ON r.id=e.revision_id
         JOIN scoring.applications a ON a.id=r.application_id
         LEFT JOIN scoring.evaluation_factors f ON f.evaluation_id=e.id
        WHERE a.public_id=$1 GROUP BY e.id`,
      [created.body.applicationId],
    );
    expect(stored.rows[0]).toEqual({ status: "error", score: null, risk_band: null, recommendation_code: null, factor_count: "0" });
  });
});
