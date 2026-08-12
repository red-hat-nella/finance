import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/load-config.js';
import type { ActorContext } from '../../src/http/middleware/request-context.js';
import { actor, requestId, scriptedPool } from '../support/fixtures.js';

const config = loadConfig({ NODE_ENV: 'test' });

describe('acceptance audit authorization', () => {
  it.each(['credit_analyst', 'terms_admin'] as const)('denies %s without querying evidence', async (role) => {
    let queried = false;
    const candidate: ActorContext = { ...actor, roles: [role] };
    const response = await request(createApp(config, scriptedPool(() => { queried = true; return { rows: [] }; }), {
      verifyJwt: () => Promise.resolve(candidate),
    })).post('/v1/audit/acceptances/search').set('Authorization', 'Bearer synthetic')
      .set('X-Request-Id', requestId).send({});
    expect(response.status).toBe(403);
    expect(queried).toBe(false);
  });

  it.each(['supervisor', 'auditor'] as const)('enforces the JWT organization for %s', async (role) => {
    const candidate: ActorContext = { actorId: `synthetic-${role}`, orgId: 'synthetic-org-beta', roles: [role] };
    let parameters: readonly unknown[] = [];
    const response = await request(createApp(config, scriptedPool((_sql, values) => {
      parameters = values ?? [];
      return { rows: [] };
    }), { verifyJwt: () => Promise.resolve(candidate) })).post('/v1/audit/acceptances/search')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId)
      .send({ orgScopeId: 'synthetic-org-alpha' });
    expect(response.status).toBe(422);
    expect(parameters).toEqual([]);

    const allowed = await request(createApp(config, scriptedPool((_sql, values) => {
      parameters = values ?? [];
      return { rows: [] };
    }), { verifyJwt: () => Promise.resolve(candidate) })).post('/v1/audit/acceptances/search')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId).send({});
    expect(allowed.status).toBe(200);
    expect(parameters[0]).toBe('synthetic-org-beta');
  });
});
