import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../../src/config/schema.js";
import type { ActorContext } from "../../../src/domain/authorization/policies.js";
import { AUDIT_EVENT_TYPES } from "../../../src/modules/audit/audit-event.js";
import { AuditRepository } from "../../../src/modules/audit/audit.repository.js";
import { PostgresAuditWriter } from "../../../src/modules/audit/audit-writer.js";
import { createAuditedEvaluation } from "../../support/audited-evaluation.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const config = configSchema.parse({
  nodeEnv: "test", port: 8080,
  database: { host: "localhost", port: 5432, name: "alternative_scoring", user: "postgres", password: "integration-password", sslMode: "disable" },
  scoring: { baseUrl: "http://scoring:8080", timeoutMs: 750, criteriaVersion: "SCORING-MVP-1.0.0", token: "s".repeat(32) },
  auth: { issuer: "http://auth:8080", audience: "alternative-credit-scoring", jwksUrl: "http://auth:8080/jwks", algorithms: ["RS256"] },
  pii: { encryptionKey: Buffer.alloc(32, 71), hmacKey: Buffer.alloc(32, 72), keyVersion: 1 },
  corsAllowedOrigins: [], logLevel: "error",
});
let pool: pg.Pool;

describeDatabase("US4 append-only audit integrity", () => {
  beforeAll(() => { pool = new pg.Pool({ connectionString: databaseUrl }); });
  afterAll(async () => pool.end());

  it("returns stable safe events and rejects mutations or sensitive canaries", async () => {
    const actor: ActorContext = { actorId: `analyst-audit-${randomUUID()}`, orgId: `org-audit-${randomUUID()}`, roles: ["credit_analyst"] };
    const fixture = await createAuditedEvaluation(pool, config, actor);
    const evaluation = await pool.query<{ id: string }>(
      `SELECT id FROM scoring.evaluations WHERE public_id=$1`, [fixture.evaluationId],
    );
    const internalId = evaluation.rows[0]?.id;
    if (!internalId) throw new Error("Evaluation fixture was not persisted.");
    await new PostgresAuditWriter(pool).write({
      type: "EVALUATION_VIEWED", orgId: actor.orgId, actorId: actor.actorId,
      roles: actor.roles, evaluationId: internalId, correlationId: randomUUID(), outcome: "success",
      metadata: { state: "evaluada", documentNumber: "CANARY-SECRET", monthlyIncomeCop: "9999999.00", authorization: "Bearer canary" },
    });
    const events = await new AuditRepository(pool).listEvents(internalId);
    expect(events.map((event) => event.eventType)).toEqual([
      "EVALUATION_STARTED", "EVALUATION_COMPLETED", "EVALUATION_VIEWED",
    ]);
    expect(events.every((event, index) => {
      const previous = events[index - 1];
      return index === 0 || (previous !== undefined && event.occurredAt >= previous.occurredAt);
    })).toBe(true);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("CANARY-SECRET");
    expect(serialized).not.toContain("9999999.00");
    expect(serialized).not.toContain("Bearer canary");
    expect(serialized).not.toContain(actor.actorId);

    const eventId = events[0]?.eventId;
    if (!eventId) throw new Error("Audit fixture did not produce events.");
    await expect(pool.query(`UPDATE scoring.audit_events SET outcome='error' WHERE event_id=$1`, [eventId])).rejects.toThrow(/append-only|immutable/i);
    await expect(pool.query(`DELETE FROM scoring.audit_events WHERE event_id=$1`, [eventId])).rejects.toThrow(/append-only|immutable/i);
    const privileges = await pool.query<{ update_allowed: boolean; delete_allowed: boolean }>(
      `SELECT has_table_privilege('scoring_app','scoring.audit_events','UPDATE') update_allowed,
              has_table_privilege('scoring_app','scoring.audit_events','DELETE') delete_allowed`,
    );
    expect(privileges.rows[0]).toEqual({ update_allowed: false, delete_allowed: false });
    expect(AUDIT_EVENT_TYPES).toEqual(expect.arrayContaining([
      "APPLICATION_CREATED", "APPLICATION_UPDATED", "CONSENT_RECORDED",
      "CRITERIA_VERSION_ACTIVATED",
      "EVALUATION_STARTED", "EVALUATION_COMPLETED", "EVALUATION_FAILED",
      "EVALUATION_RETRIED", "EVALUATION_VIEWED", "HISTORY_SEARCHED",
      "AUDIT_VIEWED", "RETENTION_COMPLETED",
    ]));
  });
});
