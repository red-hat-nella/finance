import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../../src/config/schema.js";
import type { ActorContext } from "../../../src/domain/authorization/policies.js";
import { ApplicationRepository } from "../../../src/modules/applications/application.repository.js";
import {
  ApplicationService,
} from "../../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../../src/modules/audit/audit-writer.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const fixture = JSON.parse(
  readFileSync("../../tests/fixtures/low-risk-application.json", "utf8"),
) as Record<string, unknown>;
const orgId = `org-app-${randomUUID()}`;
const actor: ActorContext = {
  actorId: `analyst-${randomUUID()}`,
  orgId,
  roles: ["credit_analyst"],
};
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
    encryptionKey: Buffer.alloc(32, 21),
    hmacKey: Buffer.alloc(32, 22),
    keyVersion: 1,
  },
  corsAllowedOrigins: [],
  logLevel: "error",
});

let pool: pg.Pool;
let service: ApplicationService;

describeDatabase("US1 PostgreSQL application lifecycle", () => {
  beforeAll(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    service = new ApplicationService(
      pool,
      new ApplicationRepository(pool, config),
      new PostgresAuditWriter(pool),
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a partial draft and replays the same idempotent response", async () => {
    const documentNumber = String(Date.now()).slice(-9);
    const input = {
      applicant: {
        documentType: "CC",
        documentNumber,
        fullName: "Andrea Lozano",
        contact: { phone: "+573001234567" },
      },
    };
    const key = randomUUID();
    const first = await service.create(input, actor, randomUUID(), key);
    const replay = await service.create(input, actor, randomUUID(), key);

    expect(first.status).toBe(201);
    expect(first.etag).toBe('"1"');
    expect(first.body).toMatchObject({
      state: "borrador",
      revisionNumber: 1,
      lockVersion: 1,
      applicant: { documentNumber, fullName: "Andrea Lozano" },
    });
    expect(first.body).not.toHaveProperty("consent");
    expect(first.body).not.toHaveProperty("alternativeData");
    expect(replay).toMatchObject({
      body: first.body,
      replayed: true,
      location: first.location,
    });
  });

  it("deduplicates open drafts, PATCHes with ETag and keeps PII encrypted", async () => {
    const input = structuredClone(fixture);
    const applicant = input["applicant"] as Record<string, unknown>;
    const documentNumber = `8${String(Date.now()).slice(-8)}`;
    applicant["documentNumber"] = documentNumber;
    applicant["fullName"] = "Valentina Cárdenas";
    const created = await service.create(
      input,
      actor,
      randomUUID(),
      randomUUID(),
    );

    await expect(
      service.create(input, actor, randomUUID(), randomUUID()),
    ).rejects.toMatchObject({
      status: 409,
      code: "DRAFT_ALREADY_EXISTS",
      existingApplicationId: created.body.applicationId,
    });

    const updated = await service.update(
      created.body.applicationId,
      {
        applicant: {
          documentType: created.body.applicant.documentType,
          documentNumber: `9${String(Date.now()).slice(-8)}`,
          fullName: "Valentina Cárdenas Ruiz",
          contact: created.body.applicant.contact,
        },
      },
      created.etag,
      actor,
      randomUUID(),
    );
    expect(updated.etag).toBe('"2"');
    expect(updated.body.applicant.fullName).toBe("Valentina Cárdenas Ruiz");
    expect(updated.body.applicant.documentNumber).not.toBe(documentNumber);
    await expect(
      service.update(
        created.body.applicationId,
        { consent: input["consent"] },
        created.etag,
        actor,
        randomUUID(),
      ),
    ).rejects.toMatchObject({
      status: 412,
      code: "PRECONDITION_FAILED",
    });

    const stored = await pool.query<{
      document_ciphertext: Buffer;
      full_name_ciphertext: Buffer;
    }>(
      `SELECT s.document_ciphertext,s.full_name_ciphertext
         FROM scoring.revision_identity_snapshots s
         JOIN scoring.application_revisions r ON r.id=s.revision_id
         JOIN scoring.applications a ON a.current_revision_id=r.id
        WHERE a.public_id=$1`,
      [created.body.applicationId],
    );
    expect(stored.rows[0]?.document_ciphertext.toString("utf8")).not.toContain(
      documentNumber,
    );
    expect(stored.rows[0]?.full_name_ciphertext.toString("utf8")).not.toContain(
      "Valentina",
    );

    const audit = await pool.query<{ metadata: unknown }>(
      `SELECT metadata FROM scoring.audit_events
        WHERE org_scope_id=$1 AND application_id=(SELECT id FROM scoring.applications WHERE public_id=$2)`,
      [orgId, created.body.applicationId],
    );
    const serialized = JSON.stringify(audit.rows);
    expect(serialized).not.toContain(documentNumber);
    expect(serialized).not.toContain("Valentina");
    expect(serialized).not.toContain("+573");
  });
});
