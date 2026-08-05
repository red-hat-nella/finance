import { randomUUID } from "node:crypto";
import express from "express";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../src/config/schema.js";
import type { ActorContext } from "../../src/domain/authorization/policies.js";
import { requestContext } from "../../src/http/middleware/request-context.js";
import { auditRoutes } from "../../src/http/routes/audit.routes.js";
import { createAuditedEvaluation } from "../support/audited-evaluation.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const config = configSchema.parse({
  nodeEnv: "test", port: 8080,
  database: { host: "localhost", port: 5432, name: "alternative_scoring", user: "postgres", password: "integration-password", sslMode: "disable" },
  scoring: { baseUrl: "http://scoring:8080", timeoutMs: 750, criteriaVersion: "SCORING-MVP-1.0.0", token: "s".repeat(32) },
  auth: { issuer: "http://auth:8080", audience: "alternative-credit-scoring", jwksUrl: "http://auth:8080/jwks", algorithms: ["RS256"] },
  pii: { encryptionKey: Buffer.alloc(32, 81), hmacKey: Buffer.alloc(32, 82), keyVersion: 1 },
  corsAllowedOrigins: [], logLevel: "error",
});
let pool: pg.Pool;
let evaluationId: string;
let owner: ActorContext;

describeDatabase("US4 audit contract and authorization", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    owner = { actorId: `analyst-owner-${randomUUID()}`, orgId: `org-audit-scope-${randomUUID()}`, roles: ["credit_analyst"] };
    evaluationId = (await createAuditedEvaluation(pool, config, owner)).evaluationId;
  });
  afterAll(async () => pool.end());

  it.each(["supervisor", "auditor"] as const)("allows %s read-only access inside the organization", async (role) => {
    const response = await request(app({ actorId: `${role}-042`, orgId: owner.orgId, roles: [role] }))
      .get(`/api/v1/evaluations/${evaluationId}/audit`)
      .expect(200);
    const body = response.body as { evaluationId: string; events: unknown[] };
    expect(body).toMatchObject({ evaluationId });
    expect(body.events.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(body)).not.toContain(owner.actorId);
  });

  it("denies analysts and audits the denied access without evaluation disclosure", async () => {
    await request(app(owner)).get(`/api/v1/evaluations/${evaluationId}/audit`).expect(403);
    const denied = await pool.query<{ evaluation_id: string | null; outcome: string }>(
      `SELECT evaluation_id,outcome FROM scoring.audit_events
        WHERE org_scope_id=$1 AND actor_id=$2 AND event_type='AUDIT_VIEWED'
        ORDER BY id DESC LIMIT 1`, [owner.orgId, owner.actorId],
    );
    expect(denied.rows[0]).toEqual({ evaluation_id: null, outcome: "denied" });
  });

  it("uses the same 404 for another organization and an unknown ID", async () => {
    const other: ActorContext = { actorId: "supervisor-other", orgId: "another-org", roles: ["supervisor"] };
    const api = app(other);
    const outside = await request(api).get(`/api/v1/evaluations/${evaluationId}/audit`).expect(404);
    const missing = await request(api).get(`/api/v1/evaluations/${randomUUID()}/audit`).expect(404);
    const outsideProblem = outside.body as { code: string; detail: string };
    const missingProblem = missing.body as { code: string; detail: string };
    expect(outsideProblem.code).toBe("EVALUATION_NOT_AVAILABLE");
    expect(missingProblem.code).toBe(outsideProblem.code);
    expect(missingProblem.detail).toBe(outsideProblem.detail);
  });
});

function app(actor: ActorContext) {
  const api = express();
  api.use(requestContext);
  api.use((req, _res, next) => { req.actor = actor; next(); });
  api.use("/api/v1", auditRoutes(pool));
  return api;
}
