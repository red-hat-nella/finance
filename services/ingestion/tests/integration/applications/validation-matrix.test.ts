import { readFileSync } from "node:fs";
import request from "supertest";
import type pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { configSchema } from "../../../src/config/schema.js";
import type { ValidationCode } from "../../../src/domain/applications/validation-messages.js";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonObject | JsonPrimitive | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

const canonical = JSON.parse(
  readFileSync("../../tests/fixtures/low-risk-application.json", "utf8"),
) as JsonObject;

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

function objectAt(value: JsonObject, ...path: string[]): JsonObject {
  let current: JsonValue = value;
  for (const segment of path) {
    if (
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current)
    )
      throw new Error(`Expected object at ${path.join(".")}`);
    current = current[segment] ?? null;
  }
  if (typeof current !== "object" || current === null || Array.isArray(current))
    throw new Error(`Expected object at ${path.join(".")}`);
  return current;
}

function arrayAt(value: JsonObject, ...path: string[]): JsonValue[] {
  let current: JsonValue = value;
  for (const segment of path) {
    if (
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current)
    )
      throw new Error(`Expected array at ${path.join(".")}`);
    current = current[segment] ?? null;
  }
  if (!Array.isArray(current))
    throw new Error(`Expected array at ${path.join(".")}`);
  return current;
}

const cases: ReadonlyArray<
  readonly [ValidationCode, (body: JsonObject) => void]
> = [
  ["VAL-001", (body) => (objectAt(body, "applicant").documentNumber = "1 23")],
  ["VAL-002", (body) => (objectAt(body, "applicant").fullName = "123")],
  ["VAL-003", (body) => (objectAt(body, "applicant").contact = {})],
  ["VAL-004", (body) => (objectAt(body, "consent").decision = "denied")],
  [
    "VAL-005",
    (body) =>
      (objectAt(body, "alternativeData", "income").monthlyIncomeCop = "0.00"),
  ],
  [
    "VAL-006",
    (body) =>
      (objectAt(body, "alternativeData", "income").sourceType = "other"),
  ],
  [
    "VAL-007",
    (body) =>
      (objectAt(body, "alternativeData", "income").stabilityMonths = 601),
  ],
  [
    "VAL-008",
    (body) => {
      const references = arrayAt(
        body,
        "alternativeData",
        "utilities",
        "references",
      );
      references.push(structuredClone(references[0] ?? null));
    },
  ],
  [
    "VAL-009",
    (body) => {
      const reference = arrayAt(
        body,
        "alternativeData",
        "utilities",
        "references",
      )[0];
      if (
        typeof reference === "object" &&
        reference &&
        !Array.isArray(reference)
      )
        reference.observedMonths = 0;
    },
  ],
  [
    "VAL-010",
    (body) => {
      const reference = arrayAt(
        body,
        "alternativeData",
        "utilities",
        "references",
      )[0];
      if (
        typeof reference === "object" &&
        reference &&
        !Array.isArray(reference)
      )
        reference.lateCount = 2;
    },
  ],
  [
    "VAL-011",
    (body) => {
      const reference = arrayAt(
        body,
        "alternativeData",
        "utilities",
        "references",
      )[0];
      if (
        typeof reference === "object" &&
        reference &&
        !Array.isArray(reference)
      )
        reference.averageMonthlyAmountCop = "0.00";
    },
  ],
  [
    "VAL-012",
    (body) => (objectAt(body, "alternativeData", "mobile").mode = "satellite"),
  ],
  [
    "VAL-013",
    (body) => (objectAt(body, "alternativeData", "mobile").tenureMonths = 601),
  ],
  [
    "VAL-014",
    (body) => (objectAt(body, "alternativeData", "mobile").regularMonths = 13),
  ],
  [
    "VAL-015",
    (body) =>
      (objectAt(body, "alternativeData").income = {
        availability: "unavailable",
        reason: "token secreto abcdefghijk",
      }),
  ],
];

describe("VAL-001..VAL-015 HTTP matrix", () => {
  it.each(cases)(
    "blocks %s before persistence",
    async (expectedCode, mutate) => {
      const body = structuredClone(canonical);
      mutate(body);
      const query = vi.fn(() => Promise.resolve({ rows: [] }));
      const pool = { query, end: vi.fn() } as unknown as pg.Pool;

      const response = await request(createApp(config, pool))
        .post("/api/v1/applications")
        .set("Content-Type", "application/json")
        .set("Idempotency-Key", "d64ccfd5-2e3c-4e44-b28f-abfa7c117001")
        .send(body)
        .expect(422);

      expect(response.headers["content-type"]).toMatch(
        /application\/problem\+json/,
      );
      const responseBody = response.body as Record<string, unknown>;
      expect(responseBody).toMatchObject({
        status: 422,
        code: "VALIDATION_FAILED",
        retryable: false,
      });
      expect(responseBody["errors"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: expectedCode }),
        ]),
      );
      expect(JSON.stringify(response.body)).not.toContain("abcde");
      expect(query).not.toHaveBeenCalled();
    },
  );

  it.each(["denied", "revoked"])(
    "blocks %s consent before creating an evaluation",
    async (decision) => {
      const body = structuredClone(canonical);
      objectAt(body, "consent").decision = decision;
      const query = vi.fn(() => Promise.resolve({ rows: [] }));
      const pool = { query, end: vi.fn() } as unknown as pg.Pool;

      const response = await request(createApp(config, pool))
        .post("/api/v1/applications")
        .set("Content-Type", "application/json")
        .set("Idempotency-Key", "d64ccfd5-2e3c-4e44-b28f-abfa7c117002")
        .send(body)
        .expect(422);

      const responseBody = response.body as Record<string, unknown>;
      expect(responseBody["errors"]).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "VAL-004" })]),
      );
      expect(query).not.toHaveBeenCalled();
    },
  );

  it("blocks absent consent before creating an evaluation", async () => {
    const body = structuredClone(canonical);
    delete body.consent;
    const query = vi.fn(() => Promise.resolve({ rows: [] }));
    const pool = { query, end: vi.fn() } as unknown as pg.Pool;

    const response = await request(createApp(config, pool))
      .post("/api/v1/applications")
      .set("Content-Type", "application/json")
      .set("Idempotency-Key", "d64ccfd5-2e3c-4e44-b28f-abfa7c117003")
      .send(body)
      .expect(422);

    const responseBody = response.body as Record<string, unknown>;
    expect(responseBody["errors"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "VAL-004" })]),
    );
    expect(query).not.toHaveBeenCalled();
  });
});
