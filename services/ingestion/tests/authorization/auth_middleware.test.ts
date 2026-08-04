import { createServer, type Server } from "node:http";
import express from "express";
import request from "supertest";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppConfig } from "../../src/config/schema.js";
import { createJwtVerifier } from "../../src/infrastructure/auth/jwt-verifier.js";
import { authenticate } from "../../src/http/middleware/authenticate.js";
import { authorizeRead } from "../../src/http/middleware/authorize.js";
import { requestContext } from "../../src/http/middleware/request-context.js";
let server: Server,
  privateKey: CryptoKey,
  jwksUrl = "";
const issuer = "https://issuer.example.test",
  audience = "alternative-credit-scoring";
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "test",
    alg: "RS256",
    use: "sig",
  };
  server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("JWKS server failed");
  jwksUrl = `http://127.0.0.1:${address.port.toString()}/jwks`;
});
afterAll(
  () =>
    new Promise<void>((resolve) =>
      server.close(() => {
        resolve();
      }),
    ),
);
function config(): AppConfig {
  return {
    auth: { issuer, audience, jwksUrl, algorithms: ["RS256"] },
  } as AppConfig;
}
async function token(
  overrides: Record<string, unknown> = {},
  subject: string | null = "analyst-1",
) {
  let signed = new SignJWT({
    org_id: "org-a",
    roles: ["credit_analyst"],
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m");
  if (subject) signed = signed.setSubject(subject);
  return signed.sign(privateKey);
}
describe("JWT/JWKS verification", () => {
  it("accepts required claims and freezes actor context", async () => {
    const actor = await createJwtVerifier(config())(await token());
    expect(actor).toEqual({
      actorId: "analyst-1",
      orgId: "org-a",
      roles: ["credit_analyst"],
    });
    expect(Object.isFrozen(actor)).toBe(true);
  });
  it.each<{
    label: string;
    issuer?: string;
    audience?: string;
    expiration?: number;
  }>([
    { label: "issuer", issuer: "https://wrong.test" },
    { label: "audience", audience: "wrong" },
    { label: "expiration", expiration: 1 },
  ])("rejects invalid $label", async (invalid) => {
    let signed = new SignJWT({ org_id: "org-a", roles: ["credit_analyst"] })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("analyst-1")
      .setIssuer(invalid.issuer ?? issuer)
      .setAudience(invalid.audience ?? audience)
      .setExpirationTime(
        invalid.expiration ?? Math.floor(Date.now() / 1000) + 300,
      );
    signed = signed.setIssuedAt();
    await expect(
      createJwtVerifier(config())(await signed.sign(privateKey)),
    ).rejects.toThrow();
  });
  it.each([{ org_id: undefined }, { roles: undefined }])(
    "rejects missing authorization claims",
    async (claims) => {
      await expect(
        createJwtVerifier(config())(await token(claims)),
      ).rejects.toThrow(/required claims/);
    },
  );
  it("rejects a missing subject", async () => {
    await expect(
      createJwtVerifier(config())(await token({}, null)),
    ).rejects.toThrow(/required claims/);
  });
  it("rejects an algorithm outside the configured allowlist", async () => {
    const pair = await generateKeyPair("ES256");
    const signed = await new SignJWT({
      org_id: "org-a",
      roles: ["credit_analyst"],
    })
      .setProtectedHeader({ alg: "ES256", kid: "test" })
      .setSubject("analyst-1")
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(pair.privateKey);
    await expect(createJwtVerifier(config())(signed)).rejects.toThrow();
  });
});
describe("authentication response", () => {
  it("returns a generic 401 without claim enumeration", async () => {
    const app = express()
      .use(requestContext)
      .use(authenticate(createJwtVerifier(config())))
      .get("/private", (_req, res) => res.json({ ok: true }));
    const response = await request(app)
      .get("/private")
      .set("Authorization", "Bearer malformed")
      .expect(401);
    const body = response.body as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify(response.body)).not.toMatch(
      /issuer|audience|org_id|roles|token/i,
    );
  });
  it("returns a generic 403 for an authenticated actor without an application role", async () => {
    const app = express()
      .use(requestContext)
      .use(authenticate(createJwtVerifier(config())))
      .use(authorizeRead)
      .get("/private", (_req, res) => res.json({ ok: true }));
    const response = await request(app)
      .get("/private")
      .set("Authorization", `Bearer ${await token({ roles: ["unrelated"] })}`)
      .expect(403);
    const body = response.body as { code: string };
    expect(body.code).toBe("FORBIDDEN");
    expect(JSON.stringify(body)).not.toMatch(/roles|unrelated|org_id/i);
  });
});
