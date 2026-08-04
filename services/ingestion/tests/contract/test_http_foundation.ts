import request from "supertest";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { configSchema } from "../../src/config/schema.js";
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
const pool = {
  query: () => Promise.resolve({ rows: [{ one: 1 }] }),
  end: () => Promise.resolve(),
} as unknown as pg.Pool;
describe("HTTP foundation", () => {
  it("propagates a valid request ID and exposes topology-safe health", async () => {
    const id = "c594ca64-2d99-4db7-9d9b-41507075ee45";
    const response = await request(createApp(config, pool))
      .get("/health/live")
      .set("X-Request-Id", id)
      .expect(200);
    expect(response.headers["x-request-id"]).toBe(id);
    expect(response.body).toEqual({
      status: "ok",
      service: "ingestion",
      version: "1.0.0",
    });
    expect(JSON.stringify(response.body)).not.toContain("postgres");
  });
  it("limits request bodies", async () => {
    const response = await request(createApp(config, pool))
      .post("/api/v1/applications")
      .set("content-type", "application/json")
      .send({ value: "x".repeat(270_000) })
      .expect(413);
    expect(response.headers["content-type"]).toMatch(
      /application\/problem\+json/,
    );
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      retryable: false,
      errors: [],
    });
    expect(body["correlationId"]).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
