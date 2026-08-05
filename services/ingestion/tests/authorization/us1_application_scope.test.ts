import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../src/config/schema.js";
import type { ActorContext } from "../../src/domain/authorization/policies.js";
import { ApplicationRepository } from "../../src/modules/applications/application.repository.js";
import {
  ApplicationService,
} from "../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../src/modules/audit/audit-writer.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const orgId = `org-scope-${randomUUID()}`;
const owner: ActorContext = {
  actorId: `owner-${randomUUID()}`,
  orgId,
  roles: ["credit_analyst"],
};
const config = configSchema.parse({
  nodeEnv: "test",
  port: 8080,
  database: { host: "localhost", port: 5432, name: "alternative_scoring", user: "postgres", password: "integration-password", sslMode: "disable" },
  scoring: { baseUrl: "http://scoring:8080", timeoutMs: 750, criteriaVersion: "SCORING-MVP-1.0.0", token: "s".repeat(32) },
  auth: { issuer: "http://auth:8080", audience: "alternative-credit-scoring", jwksUrl: "http://auth:8080/jwks", algorithms: ["RS256"] },
  pii: { encryptionKey: Buffer.alloc(32, 31), hmacKey: Buffer.alloc(32, 32), keyVersion: 1 },
  corsAllowedOrigins: [],
  logLevel: "error",
});
let pool: pg.Pool;
let service: ApplicationService;
let applicationId: string;

describeDatabase("US1 application authorization scope", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    service = new ApplicationService(pool, new ApplicationRepository(pool, config), new PostgresAuditWriter(pool));
    const created = await service.create(
      {
        applicant: {
          documentType: "CE",
          documentNumber: `A${String(Date.now()).slice(-7)}`,
          fullName: "Persona Autorizada",
          contact: { email: "scope@example.test" },
        },
      },
      owner,
      randomUUID(),
      randomUUID(),
    );
    applicationId = created.body.applicationId;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("allows the owner to mutate and a supervisor in the organization to read", async () => {
    await expect(service.get(applicationId, owner)).resolves.toMatchObject({ status: 200 });
    await expect(
      service.get(applicationId, {
        actorId: "supervisor-local",
        orgId,
        roles: ["supervisor"],
      }),
    ).resolves.toMatchObject({ status: 200 });
  });

  it("returns the same 404 outside owner scope or organization", async () => {
    const actors: ActorContext[] = [
      { actorId: "another-analyst", orgId, roles: ["credit_analyst"] },
      { actorId: "external-supervisor", orgId: "another-org", roles: ["supervisor"] },
    ];
    for (const candidate of actors)
      await expect(service.get(applicationId, candidate)).rejects.toMatchObject({
        status: 404,
        code: "APPLICATION_NOT_FOUND",
        detail: "No se encontró la solicitud solicitada.",
      });
  });
});
