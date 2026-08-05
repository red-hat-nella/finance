import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../src/config/schema.js";
import type { ActorContext } from "../../src/domain/authorization/policies.js";
import { ApplicationRepository } from "../../src/modules/applications/application.repository.js";
import { ApplicationService } from "../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../src/modules/audit/audit-writer.js";
import { RetentionService } from "../../src/modules/retention/retention.service.js";
import { createAuditedEvaluation } from "../support/audited-evaluation.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const now = new Date("2031-08-04T12:00:00.000Z");
const config = configSchema.parse({
  nodeEnv: "test",
  port: 8080,
  database: {
    host: "localhost",
    port: 5432,
    name: "alternative_scoring",
    user: "postgres",
    password: "integration-password",
    sslMode: "disable",
  },
  scoring: {
    baseUrl: "http://scoring:8080",
    timeoutMs: 750,
    criteriaVersion: "SCORING-MVP-1.0.0",
    token: "s".repeat(32),
  },
  auth: {
    issuer: "http://auth:8080",
    audience: "alternative-credit-scoring",
    jwksUrl: "http://auth:8080/jwks",
    algorithms: ["RS256"],
  },
  pii: {
    encryptionKey: Buffer.alloc(32, 91),
    hmacKey: Buffer.alloc(32, 92),
    keyVersion: 1,
  },
  corsAllowedOrigins: [],
  logLevel: "error",
});

let pool: pg.Pool;

describeDatabase("retention disposal", () => {
  beforeAll(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
  });
  afterAll(async () => pool.end());

  it("deletes expired drafts and irreversibly anonymizes five-year evidence while preserving the score", async () => {
    const actor: ActorContext = {
      actorId: `retention-canary-${randomUUID()}`,
      orgId: `org-retention-${randomUUID()}`,
      roles: ["credit_analyst"],
    };
    const evaluated = await createAuditedEvaluation(pool, config, actor);
    const internal = await pool.query<{
      id: string;
      revision_id: string;
      application_id: string;
      consent_id: string;
    }>(
      `SELECT e.id,e.revision_id,r.application_id,r.consent_id
         FROM scoring.evaluations e
         JOIN scoring.application_revisions r ON r.id=e.revision_id
        WHERE e.public_id=$1`,
      [evaluated.evaluationId],
    );
    const evidence = internal.rows[0];
    if (!evidence) throw new Error("Evaluation fixture was not persisted");
    await pool.query("UPDATE scoring.evaluations SET retention_until=$2 WHERE id=$1", [
      evidence.id,
      new Date("2030-08-04T12:00:00Z"),
    ]);
    await pool.query("UPDATE scoring.consents SET retention_until=$2 WHERE id=$1", [
      evidence.consent_id,
      new Date("2030-08-04T12:00:00Z"),
    ]);

    const draft = await createExpiredDraft(pool, actor);
    const staleAuditId = randomUUID();
    await pool.query(
      `INSERT INTO scoring.audit_events(event_id,occurred_at,org_scope_id,actor_id,actor_roles,event_type,correlation_id,outcome,metadata)
       VALUES($1,$2,$3,$4,$5,'HISTORY_SEARCHED',$6,'success',$7::jsonb)`,
      [
        staleAuditId,
        new Date("2026-08-03T12:00:00Z"),
        actor.orgId,
        actor.actorId,
        actor.roles,
        randomUUID(),
        JSON.stringify({ filterTypes: ["document-canary"], secret: "Bearer canary" }),
      ],
    );

    const service = new RetentionService(pool);
    const preview = await service.run({ dryRun: true, now, batchSize: 500 });
    expect(preview).toMatchObject({
      lockAcquired: true,
      dryRun: true,
      draftDeleted: 1,
      evaluationsAnonymized: 1,
      auditEventsAnonymized: 2,
    });
    expect(
      await pool.query("SELECT 1 FROM scoring.applications WHERE public_id=$1", [draft]),
    ).toHaveProperty("rowCount", 1);

    const result = await service.run({
      dryRun: false,
      now,
      batchSize: 500,
      initiatedBy: "retention-test",
    });
    expect(result.draftDeleted).toBe(1);
    expect(result.evaluationsAnonymized).toBe(1);
    expect(result.consentsDeleted).toBeGreaterThanOrEqual(2);
    expect(result.auditEventsAnonymized).toBeGreaterThanOrEqual(4);

    expect(
      await pool.query("SELECT 1 FROM scoring.applications WHERE public_id=$1", [draft]),
    ).toHaveProperty("rowCount", 0);
    expect(
      await pool.query("SELECT 1 FROM scoring.evaluations WHERE public_id=$1", [evaluated.evaluationId]),
    ).toHaveProperty("rowCount", 0);

    const anonymous = await pool.query<{
      score: number;
      risk_band: string;
      public_id: string | null;
      revision_id: string | null;
      org_scope_id: string | null;
      owner_actor_id: string | null;
      document_masked: string | null;
      applicant_display_name: string | null;
      anonymized_at: Date | null;
    }>(
      `SELECT score,risk_band,public_id,revision_id,org_scope_id,owner_actor_id,
              document_masked,applicant_display_name,anonymized_at
         FROM scoring.evaluations WHERE id=$1`,
      [evidence.id],
    );
    expect(anonymous.rows[0]).toMatchObject({
      score: 835,
      risk_band: "riesgo_bajo",
      public_id: null,
      revision_id: null,
      org_scope_id: null,
      owner_actor_id: null,
      document_masked: null,
      applicant_display_name: null,
    });
    expect(anonymous.rows[0]?.anonymized_at?.toISOString()).toBe(now.toISOString());
    expect(
      await pool.query("SELECT 1 FROM scoring.evaluation_factors WHERE evaluation_id=$1", [evidence.id]),
    ).toHaveProperty("rowCount", 3);
    expect(
      await pool.query("SELECT 1 FROM scoring.revision_identity_snapshots WHERE revision_id=$1", [evidence.revision_id]),
    ).toHaveProperty("rowCount", 0);
    expect(
      await pool.query("SELECT 1 FROM scoring.consents WHERE id=$1", [evidence.consent_id]),
    ).toHaveProperty("rowCount", 0);

    const staleAudit = await pool.query<{
      org_scope_id: string | null;
      actor_id: string | null;
      application_id: string | null;
      evaluation_id: string | null;
      metadata: Record<string, unknown>;
    }>(
      `SELECT org_scope_id,actor_id,application_id,evaluation_id,metadata
         FROM scoring.audit_events WHERE event_id=$1`,
      [staleAuditId],
    );
    expect(staleAudit.rows[0]).toEqual({
      org_scope_id: null,
      actor_id: null,
      application_id: null,
      evaluation_id: null,
      metadata: { retentionAction: "audit_anonymized" },
    });

    const completed = await pool.query<{
      org_scope_id: string | null;
      actor_id: string | null;
      metadata: Record<string, unknown>;
    }>(
      `SELECT org_scope_id,actor_id,metadata FROM scoring.audit_events
        WHERE event_type='RETENTION_COMPLETED' AND correlation_id=$1`,
      [result.runId],
    );
    expect(completed.rows[0]?.org_scope_id).toBeNull();
    expect(completed.rows[0]?.actor_id).toBeNull();
    expect(completed.rows[0]?.metadata).toMatchObject({
      retentionRunId: result.runId,
      retentionAction: "delete_and_anonymize",
      draftDeleted: 1,
      evaluationsAnonymized: 1,
    });
    const serialized = JSON.stringify({ anonymous: anonymous.rows[0], completed: completed.rows[0] });
    expect(serialized).not.toContain(actor.actorId);
    expect(serialized).not.toContain("Bearer canary");
  });
});

async function createExpiredDraft(pool: pg.Pool, actor: ActorContext): Promise<string> {
  const input = JSON.parse(
    readFileSync("../../tests/fixtures/low-risk-application.json", "utf8"),
  ) as Record<string, unknown>;
  (input["applicant"] as Record<string, unknown>)["documentNumber"] =
    `7${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 10).toString()}`;
  const service = new ApplicationService(
    pool,
    new ApplicationRepository(pool, config),
    new PostgresAuditWriter(pool),
  );
  const created = await service.create(input, actor, randomUUID(), randomUUID());
  const expiresAt = new Date("2030-08-04T12:00:00Z");
  await pool.query(
    "UPDATE scoring.applications SET draft_expires_at=$2 WHERE public_id=$1",
    [created.body.applicationId, expiresAt],
  );
  await pool.query(
    `UPDATE scoring.application_revisions SET draft_expires_at=$2
      WHERE application_id=(SELECT id FROM scoring.applications WHERE public_id=$1)`,
    [created.body.applicationId, expiresAt],
  );
  return created.body.applicationId;
}
