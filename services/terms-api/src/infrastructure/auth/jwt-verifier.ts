import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppConfig } from '../../config/schema.js';
import {
  APP_ROLES,
  type ActorContext,
  type AppRole,
} from '../../http/middleware/request-context.js';

export type JwtVerifier = (token: string) => Promise<ActorContext>;

export function createJwtVerifier(config: Pick<AppConfig, 'auth'>): JwtVerifier {
  const jwks = createRemoteJWKSet(new URL(config.auth.jwksUrl), {
    timeoutDuration: 2_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  });
  return async (token: string): Promise<ActorContext> => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      algorithms: config.auth.algorithms,
      maxTokenAge: '15m',
      clockTolerance: 5,
    });
    if (
      typeof payload.sub !== 'string' ||
      payload.sub.length < 1 ||
      payload.sub.length > 128 ||
      typeof payload.org_id !== 'string' ||
      payload.org_id.length < 1 ||
      payload.org_id.length > 128 ||
      !Array.isArray(payload.roles)
    ) {
      throw new Error('required claims are absent or invalid');
    }
    const roles = payload.roles.filter(
      (role): role is AppRole =>
        typeof role === 'string' && APP_ROLES.includes(role as AppRole),
    );
    return Object.freeze({
      actorId: payload.sub,
      orgId: payload.org_id,
      roles: Object.freeze(roles),
    });
  };
}
