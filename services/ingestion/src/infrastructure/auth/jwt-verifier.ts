import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppConfig } from "../../config/schema.js";
import type {
  ActorContext,
  AppRole,
} from "../../domain/authorization/policies.js";
export function createJwtVerifier(config: AppConfig) {
  const jwks = createRemoteJWKSet(new URL(config.auth.jwksUrl));
  return async (token: string): Promise<ActorContext> => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      algorithms: config.auth.algorithms,
    });
    if (
      !payload.sub ||
      typeof payload.org_id !== "string" ||
      !Array.isArray(payload.roles)
    )
      throw new Error("required claims are absent");
    const roles = payload.roles.filter((role): role is AppRole =>
      ["credit_analyst", "supervisor", "auditor"].includes(String(role)),
    );
    return Object.freeze({
      actorId: payload.sub,
      orgId: payload.org_id,
      roles: Object.freeze(roles),
    });
  };
}
