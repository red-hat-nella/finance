/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */
import request from "supertest";
import type pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { configSchema } from "../../src/config/schema.js";

const serviceToken = "t".repeat(48);
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
    token: "s".repeat(32),
  },
  termsAccess: {
    baseUrl: "http://terms-api:8080",
    timeoutMs: 500,
    token: serviceToken,
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

const operations = [
  ["post", "/api/v1/applications"],
  ["get", "/api/v1/applications/10000000-0000-4000-8000-000000000001"],
  ["patch", "/api/v1/applications/10000000-0000-4000-8000-000000000001"],
  ["post", "/api/v1/applications/10000000-0000-4000-8000-000000000001/evaluations"],
  ["post", "/api/v1/evaluations/search"],
  ["post", "/api/v1/evaluations/20000000-0000-4000-8000-000000000001/retry"],
  ["get", "/api/v1/evaluations/20000000-0000-4000-8000-000000000001"],
  ["get", "/api/v1/evaluations/20000000-0000-4000-8000-000000000001/audit"],
] as const;

function pool() {
  return {
    query: vi.fn(() => Promise.reject(new Error("business data must not load"))),
  } as unknown as pg.Pool;
}

async function call(app: ReturnType<typeof createApp>, method: (typeof operations)[number][0], path: string) {
  const agent = request(app);
  const pending = method === "get" ? agent.get(path) : method === "patch" ? agent.patch(path) : agent.post(path);
  return pending
    .set("Authorization", "Bearer original-user-jwt")
    .set("Content-Type", method === "patch" ? "application/merge-patch+json" : "application/json")
    .send({});
}

afterEach(() => vi.unstubAllGlobals());

describe("mandatory terms gate", () => {
  it("fails closed when the terms dependency is not configured", async () => {
    const database = pool();
    const missingTermsConfig = configSchema.parse({
      ...config,
      termsAccess: undefined,
      termsGateTestBypass: false,
    });

    const response = await call(
      createApp(missingTermsConfig, database),
      "post",
      "/api/v1/evaluations/search",
    );
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("TERMS_SERVICE_UNAVAILABLE");
    expect(database.query).not.toHaveBeenCalled();
  });

  it("rejects the explicit test bypass in production configuration", () => {
    expect(() =>
      configSchema.parse({
        ...config,
        nodeEnv: "production",
        termsAccess: undefined,
        termsGateTestBypass: true,
      }),
    ).toThrow(/terms gate bypass is forbidden in production/);
  });

  it.each(operations)("returns 428 before business data for %s %s", async (method, path) => {
    const database = pool();
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            allowed: false,
            currentVersionId: "30000000-0000-4000-8000-000000000001",
            currentVersionCode: "TERMS-1.0.0",
            acceptedVersionId: null,
            checkedAt: "2026-08-12T14:00:00Z",
            reason: "ACCEPTANCE_REQUIRED",
            acceptanceUrl: "/terms/",
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await call(createApp(config, database), method, path);

    expect(response.status).toBe(428);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({
      status: 428,
      code: "TERMS_ACCEPTANCE_REQUIRED",
      retryable: false,
      acceptanceUrl: "/terms/",
    });
    expect(database.query).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer original-user-jwt",
      "X-Service-Token": serviceToken,
    });
  });

  it.each(operations)("returns 503 before business data for %s %s when terms is unavailable", async (method, path) => {
    const database = pool();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("connection refused"))));

    const response = await call(createApp(config, database), method, path);

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({
      status: 503,
      code: "TERMS_SERVICE_UNAVAILABLE",
      retryable: true,
    });
    expect(response.body).not.toHaveProperty("acceptanceUrl");
    expect(database.query).not.toHaveBeenCalled();
  });

  it("maps no effective version to unavailable rather than an impossible acceptance", async () => {
    const database = pool();
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        allowed: false,
        currentVersionId: null,
        currentVersionCode: null,
        acceptedVersionId: null,
        checkedAt: "2026-08-12T14:00:00Z",
        reason: "NO_EFFECTIVE_VERSION",
      }), { status: 200 })),
    ));

    const response = await call(createApp(config, database), "post", "/api/v1/evaluations/search");
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("TERMS_SERVICE_UNAVAILABLE");
    expect(database.query).not.toHaveBeenCalled();
  });
});
