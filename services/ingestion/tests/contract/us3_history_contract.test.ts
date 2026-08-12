import request from "supertest";
import type pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { configSchema } from "../../src/config/schema.js";
import { encryptField } from "../../src/infrastructure/crypto/field-crypto.js";

const config = configSchema.parse({
  nodeEnv: "development",
  port: 8080,
  database: {
    host: "localhost",
    port: 5432,
    name: "test",
    user: "test",
    password: "long-password",
    sslMode: "disable",
  },
  scoring: {
    baseUrl: "http://scoring:8080",
    timeoutMs: 750,
    criteriaVersion: "SCORING-MVP-1.0.0",
    token: "a".repeat(32),
  },
  termsGateTestBypass: true,
  auth: {
    issuer: "http://auth:8080",
    audience: "alternative-credit-scoring",
    jwksUrl: "http://auth:8080/jwks",
    algorithms: ["RS256"],
  },
  pii: {
    encryptionKey: Buffer.alloc(32),
    hmacKey: Buffer.alloc(32),
    keyVersion: 1,
  },
  corsAllowedOrigins: [],
  logLevel: "error",
});

describe("US3 public producer contract", () => {
  it("returns a fixed page with only minimized history fields", async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes("count(*)"))
        return Promise.resolve({ rows: [{ total: "1" }] });
      if (sql.includes("FROM scoring.evaluations WHERE"))
        return Promise.resolve({
          rows: [
            {
              public_id: "20000000-0000-4000-8000-000000000001",
              completed_at: new Date("2026-08-03T14:06:00.312Z"),
              document_masked: "CC ••••••1032",
              applicant_display_name: "Maria P.",
              score: 835,
              risk_band: "riesgo_bajo",
              status: "evaluada",
            },
          ],
        });
      return Promise.resolve({ rows: [], rowCount: 1 });
    });
    const pool = { query, end: vi.fn() } as unknown as pg.Pool;

    const response = await request(createApp(config, pool))
      .post("/api/v1/evaluations/search")
      .set("Content-Type", "application/json")
      .send({ page: 1, states: ["evaluada"] })
      .expect(200);

    expect(response.body).toEqual({
      items: [
        {
          evaluationId: "20000000-0000-4000-8000-000000000001",
          completedAt: "2026-08-03T14:06:00.312Z",
          timezone: "America/Bogota",
          documentMasked: "CC ••••••1032",
          displayName: "Maria P.",
          score: 835,
          riskBand: "riesgo_bajo",
          state: "evaluada",
        },
      ],
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /documentNumber|fullName|phone|email/,
    );
  });

  it("returns contractual VAL-016 and VAL-017 problems", async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [] }));
    const pool = { query, end: vi.fn() } as unknown as pg.Pool;

    const dateResponse = await request(createApp(config, pool))
      .post("/api/v1/evaluations/search")
      .set("Content-Type", "application/json")
      .send({ page: 1, dateFrom: "2026-08-03", dateTo: "2026-08-01" })
      .expect(422);
    const stateResponse = await request(createApp(config, pool))
      .post("/api/v1/evaluations/search")
      .set("Content-Type", "application/json")
      .send({ page: 1, states: ["unknown"] })
      .expect(422);

    const dateBody = dateResponse.body as Record<string, unknown>;
    const stateBody = stateResponse.body as Record<string, unknown>;
    expect(dateBody["errors"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "VAL-016" })]),
    );
    expect(stateBody["errors"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "VAL-017" })]),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("returns the authorized detail, late-decrypted snapshot and related attempts", async () => {
    const evaluationId = "20000000-0000-4000-8000-000000000001";
    const applicationId = "10000000-0000-4000-8000-000000000001";
    const document = encryptField("1032456789", config.pii.encryptionKey);
    const fullName = encryptField("María Pérez", config.pii.encryptionKey);
    const phone = encryptField("+573001234567", config.pii.encryptionKey);
    const query = vi.fn((sql: string) => {
      if (sql.includes("FROM scoring.evaluations e"))
        return Promise.resolve({
          rows: [
            {
              id: "21000000-0000-4000-8000-000000000001",
              public_id: evaluationId,
              revision_id: "11000000-0000-4000-8000-000000000001",
              application_id: "12000000-0000-4000-8000-000000000001",
              application_public_id: applicationId,
              revision_number: 1,
              attempt_number: 1,
              status: "evaluada",
              score: 835,
              risk_band: "riesgo_bajo",
              recommendation_code: "CONTINUE_HUMAN_ANALYSIS",
              recommendation_text:
                "Continuar con el análisis crediticio humano.",
              manual_review_reasons: [],
              criteria_version: "SCORING-MVP-1.0.0",
              input_hash: Buffer.alloc(32, 10),
              started_at: new Date("2026-08-03T14:06:00Z"),
              completed_at: new Date("2026-08-03T14:06:00.100Z"),
              document_masked: "CC ••••••1032",
              applicant_display_name: "Maria P.",
            },
          ],
        });
      if (sql.includes("FROM scoring.application_revisions r"))
        return Promise.resolve({
          rows: [
            {
              application_public_id: applicationId,
              application_status: "evaluada",
              application_created_at: new Date("2026-08-03T14:00:00Z"),
              application_updated_at: new Date("2026-08-03T14:06:00Z"),
              draft_expires_at: null,
              revision_number: 1,
              lock_version: 1,
              document_type: "CC",
              document_ciphertext: document.ciphertext,
              document_nonce: document.nonce,
              document_tag: document.tag,
              document_masked: "CC ••••••6789",
              full_name_ciphertext: fullName.ciphertext,
              full_name_nonce: fullName.nonce,
              full_name_tag: fullName.tag,
              display_name: "María P.",
              phone_ciphertext: phone.ciphertext,
              phone_nonce: phone.nonce,
              phone_tag: phone.tag,
              email_ciphertext: null,
              email_nonce: null,
              email_tag: null,
              consent_status: "accepted",
              notice_version: "PRIVACY-2026-01",
              purpose_code: "ALTERNATIVE_CREDIT_RISK_EVALUATION",
              consent_recorded_at: new Date("2026-08-03T14:00:00Z"),
              income_status: "provided",
              income_unavailable_reason: null,
              utilities_status: "provided",
              utilities_unavailable_reason: null,
              mobile_status: "provided",
              mobile_unavailable_reason: null,
              monthly_income_cop: "4200000.00",
              source_type: "employment",
              source_other_description: null,
              stability_months: 36,
              mobile_mode: "postpaid",
              tenure_months: 48,
              mobile_observed_months: 12,
              regular_months: 12,
            },
          ],
        });
      if (sql.includes("FROM scoring.utility_references"))
        return Promise.resolve({
          rows: [
            {
              service_type: "electricity",
              period_start: "2025-08-01",
              period_end: "2026-07-31",
              observed_months: 12,
              total_obligations: 12,
              on_time_count: 12,
              late_count: 0,
              missed_count: 0,
              average_monthly_amount_cop: "250000.00",
            },
          ],
        });
      if (sql.includes("FROM scoring.evaluation_factors"))
        return Promise.resolve({
          rows: [
            {
              rank: 1,
              dimension: "utility",
              direction: "favorable",
              rule_code: "UTILITY_INDEX",
              contribution_points: "220.000",
              dimension_index: "100.000",
              weight: "0.400",
              observed_summary: "12 de 12 obligaciones pagadas puntualmente.",
              explanation: "Los pagos puntuales favorecen el resultado.",
            },
          ],
        });
      if (sql.includes("FROM scoring.evaluations\n"))
        return Promise.resolve({
          rows: [
            {
              public_id: "20000000-0000-4000-8000-000000000002",
              attempt_number: 2,
              status: "error",
              started_at: new Date("2026-08-03T14:04:00Z"),
              completed_at: new Date("2026-08-03T14:04:01Z"),
              error_code: "SCORING_TIMEOUT",
            },
          ],
        });
      return Promise.resolve({ rows: [] });
    });
    const pool = { query, end: vi.fn() } as unknown as pg.Pool;

    const response = await request(createApp(config, pool))
      .get(`/api/v1/evaluations/${evaluationId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      evaluationId,
      applicationId,
      state: "evaluada",
      score: 835,
      applicantSummary: {
        documentMasked: "CC ••••••1032",
        displayName: "Maria P.",
      },
      inputSnapshot: {
        applicationId,
        applicant: {
          documentNumber: "1032456789",
          fullName: "María Pérez",
          contact: { phone: "+573001234567" },
        },
      },
      relatedAttempts: [
        {
          evaluationId: "20000000-0000-4000-8000-000000000002",
          attemptNumber: 2,
          state: "error",
          errorCode: "SCORING_TIMEOUT",
        },
      ],
    });
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const auditCall = query.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO scoring.audit_events"),
    );
    expect(JSON.stringify(auditCall)).not.toMatch(
      /1032456789|María Pérez|573001234567/,
    );
  });

  it("uses the same 404 for malformed, missing and unauthorized IDs", async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [] }));
    const pool = { query, end: vi.fn() } as unknown as pg.Pool;

    const malformed = await request(createApp(config, pool))
      .get("/api/v1/evaluations/not-a-uuid")
      .expect(404);
    const inaccessible = await request(createApp(config, pool))
      .get("/api/v1/evaluations/20000000-0000-4000-8000-000000000009")
      .expect(404);

    const malformedBody = malformed.body as Record<string, unknown>;
    const inaccessibleBody = inaccessible.body as Record<string, unknown>;
    expect(malformedBody).toMatchObject({ code: "EVALUATION_NOT_FOUND" });
    expect(inaccessibleBody).toMatchObject({
      code: "EVALUATION_NOT_FOUND",
      detail: malformedBody["detail"],
    });
  });
});
