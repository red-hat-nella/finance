import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "../../../src/config/schema.js";
import { documentBlindIndex } from "../../../src/infrastructure/crypto/blind-index.js";
import { PostgresAuditWriter } from "../../../src/modules/audit/audit-writer.js";
import { EvaluationDetailRepository } from "../../../src/modules/history/get-evaluation-detail.service.js";
import { HistoryRepository } from "../../../src/modules/history/history.repository.js";
import { SearchHistoryService } from "../../../src/modules/history/search-history.service.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const orgA = `org-history-${randomUUID()}`;
const orgB = `org-history-${randomUUID()}`;
const ownerA = `analyst-${randomUUID()}`;
const ownerB = `analyst-${randomUUID()}`;
const hmacKey = Buffer.alloc(32, 11);
const encryptionKey = Buffer.alloc(32, 12);
const targetDocument = "AB123456";
const targetIndex = documentBlindIndex(orgA, "CE", targetDocument, hmacKey);

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
  pii: { encryptionKey, hmacKey, keyVersion: 1 },
  corsAllowedOrigins: [],
  logLevel: "error",
});

let pool: pg.Pool;
let repository: HistoryRepository;
let service: SearchHistoryService;
const ownIds: string[] = [];
let documentEvaluationId = "";
let otherOwnerEvaluationId = "";
let otherOrgEvaluationId = "";

describeDatabase("US3 PostgreSQL history integration", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    repository = new HistoryRepository(pool);
    service = new SearchHistoryService(
      repository,
      new PostgresAuditWriter(pool),
      config,
    );

    const base = new Date("2026-08-03T18:00:00.000Z").getTime();
    for (let index = 0; index < 27; index += 1) {
      const id = randomUUID();
      ownIds.push(id);
      await insertEvaluation({
        publicId: id,
        orgId: orgA,
        ownerId: ownerA,
        completedAt: new Date(base + index * 60_000),
        status: index === 3 ? "error" : "evaluada",
      });
    }

    documentEvaluationId = randomUUID();
    await insertEvaluation({
      publicId: documentEvaluationId,
      orgId: orgA,
      ownerId: ownerA,
      completedAt: new Date("2026-08-03T05:00:00.000Z"),
      status: "revision_manual",
      documentIndex: targetIndex,
    });
    await insertEvaluation({
      publicId: randomUUID(),
      orgId: orgA,
      ownerId: ownerA,
      completedAt: new Date("2026-08-04T04:59:59.999Z"),
      status: "revision_manual",
    });
    await insertEvaluation({
      publicId: randomUUID(),
      orgId: orgA,
      ownerId: ownerA,
      completedAt: new Date("2026-08-03T04:59:59.999Z"),
      status: "revision_manual",
    });

    otherOwnerEvaluationId = randomUUID();
    await insertEvaluation({
      publicId: otherOwnerEvaluationId,
      orgId: orgA,
      ownerId: ownerB,
      completedAt: new Date("2026-08-05T12:00:00.000Z"),
      status: "evaluada",
    });
    otherOrgEvaluationId = randomUUID();
    await insertEvaluation({
      publicId: otherOrgEvaluationId,
      orgId: orgB,
      ownerId: ownerB,
      completedAt: new Date("2026-08-06T12:00:00.000Z"),
      status: "evaluada",
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns fixed pages of 25 with a stable completed_at/id tie-break", async () => {
    const first = await repository.search(
      { orgId: orgA, ownerActorId: ownerA },
      {
        page: 1,
        states: ["evaluada", "revision_manual", "error"],
      },
    );
    const second = await repository.search(
      { orgId: orgA, ownerActorId: ownerA },
      {
        page: 2,
        states: ["evaluada", "revision_manual", "error"],
      },
    );

    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(5);
    expect(first.totalItems).toBe(30);
    const ids = [...first.items, ...second.items].map(
      (item) => item.evaluationId,
    );
    expect(new Set(ids).size).toBe(30);
    const timestamps = [...first.items, ...second.items].map((item) =>
      item.completedAt.getTime(),
    );
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("applies exact ID, HMAC document, inclusive Bogota dates and state", async () => {
    const byDocument = await service.execute(
      {
        page: 1,
        applicantIdentifier: {
          documentType: "CE",
          documentNumber: " ab123456 ",
        },
      },
      { actorId: ownerA, orgId: orgA, roles: ["credit_analyst"] },
      randomUUID(),
    );
    expect(byDocument.items.map((item) => item.evaluationId)).toEqual([
      documentEvaluationId,
    ]);

    const byId = await repository.search(
      { orgId: orgA, ownerActorId: ownerA },
      {
        page: 1,
        evaluationId: documentEvaluationId,
        states: ["revision_manual"],
      },
    );
    expect(byId.items).toHaveLength(1);

    const byDateAndState = await repository.search(
      { orgId: orgA, ownerActorId: ownerA },
      {
        page: 1,
        dateFrom: "2026-08-03",
        dateTo: "2026-08-03",
        states: ["revision_manual"],
      },
    );
    expect(byDateAndState.items).toHaveLength(2);
    expect(
      byDateAndState.items.every((item) => item.state === "revision_manual"),
    ).toBe(true);
  });

  it("limits analysts to owner scope and supervisors to organization scope", async () => {
    const analyst = await repository.search(
      { orgId: orgA, ownerActorId: ownerA },
      { page: 1, states: ["evaluada"] },
    );
    const supervisor = await repository.search(
      { orgId: orgA },
      { page: 1, states: ["evaluada"] },
    );
    const wrongOrg = await repository.search(
      { orgId: orgB },
      {
        page: 1,
        evaluationId: otherOwnerEvaluationId,
        states: ["evaluada"],
      },
    );

    expect(
      analyst.items.some(
        (item) => item.evaluationId === otherOwnerEvaluationId,
      ),
    ).toBe(false);
    expect(
      supervisor.items.some(
        (item) => item.evaluationId === otherOwnerEvaluationId,
      ),
    ).toBe(true);
    expect(wrongOrg.items).toHaveLength(0);
  });

  it("returns indistinguishable misses for unknown and out-of-scope details", async () => {
    const details = new EvaluationDetailRepository(pool);
    const actor = { actorId: ownerA, orgId: orgA, roles: ["credit_analyst"] };
    const missing = await details.findAuthorized(randomUUID(), actor);
    const outside = await details.findAuthorized(otherOrgEvaluationId, actor);
    expect(missing).toBeNull();
    expect(outside).toBeNull();
  });
});

async function insertEvaluation(input: {
  publicId: string;
  orgId: string;
  ownerId: string;
  completedAt: Date;
  status: "evaluada" | "revision_manual" | "error";
  documentIndex?: Buffer;
}): Promise<void> {
  const error = input.status === "error";
  const manual = input.status === "revision_manual";
  await pool.query(
    `INSERT INTO scoring.evaluations(
       public_id,revision_id,attempt_number,org_scope_id,owner_actor_id,
       initiated_by_actor_id,document_blind_index,document_masked,
       applicant_display_name,status,score,risk_band,recommendation_code,
       recommendation_text,manual_review_reasons,criteria_version,input_hash,
       correlation_id,error_code,started_at,completed_at,retention_until)
     VALUES($1,NULL,1,$2,$3,$3,$4,'CE ••••••3456','Integration U.',$5,$6,$7,$8,$9,$10,
            'SCORING-MVP-1.0.0',$11,$12,$13,$14,$15,$16)`,
    [
      input.publicId,
      input.orgId,
      input.ownerId,
      input.documentIndex ?? Buffer.alloc(32, 7),
      input.status,
      error ? null : manual ? 620 : 780,
      error ? null : manual ? "riesgo_medio" : "riesgo_bajo",
      error
        ? null
        : manual
          ? "MANUAL_REVIEW_REQUIRED"
          : "CONTINUE_HUMAN_ANALYSIS",
      error ? null : "Recomendación sujeta a decisión humana.",
      manual
        ? JSON.stringify([
            {
              code: "MEDIUM_RISK_BAND",
              dimension: "explanation",
              message: "La banda media requiere revisión.",
            },
          ])
        : "[]",
      Buffer.alloc(32, 3),
      randomUUID(),
      error ? "SCORING_TIMEOUT" : null,
      new Date(input.completedAt.getTime() - 250),
      input.completedAt,
      new Date(input.completedAt.getTime() + 365 * 86_400_000),
    ],
  );
}
