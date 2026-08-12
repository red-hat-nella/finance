import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/load-config.js';
import {
  actor, digest, idempotencyKey, requestId, scriptedPool, versionId, versionRow,
} from '../support/fixtures.js';

const config = loadConfig({ NODE_ENV: 'test' });

describe('acceptance authorization boundaries', () => {
  it('requires a verified JWT for public operations', async () => {
    const response = await request(createApp(config, scriptedPool(() => ({ rows: [] })), {
      verifyJwt: () => Promise.reject(new Error('synthetic invalid JWT')),
    })).get('/v1/current').set('Authorization', 'Bearer invalid').set('X-Request-Id', requestId);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects forged actor or organization input before persistence', async () => {
    let queried = false;
    const response = await request(createApp(config, scriptedPool(() => {
      queried = true;
      return { rows: [] };
    }), { verifyJwt: () => Promise.resolve(actor) }))
      .post('/v1/acceptances').set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId).set('Idempotency-Key', idempotencyKey)
      .send({ versionId, contentSha256: digest, actorId: 'forged', orgScopeId: 'forged-org' });
    expect(response.status).toBe(422);
    expect(queried).toBe(false);
  });

  it('derives actor and organization query scope exclusively from JWT claims', async () => {
    const observed: readonly unknown[][] = [];
    const pool = scriptedPool((sql, values) => {
      if (sql.includes('FROM terms.terms_versions')) return { rows: [versionRow] };
      if (sql.includes('FROM terms.terms_acceptances')) {
        (observed as unknown[][]).push([...(values ?? [])]);
        return { rows: [] };
      }
      return { rows: [] };
    });
    const response = await request(createApp(config, pool, { verifyJwt: () => Promise.resolve(actor) }))
      .get('/v1/current').set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId);
    expect(response.status).toBe(200);
    expect(observed).toEqual([[actor.actorId, actor.orgId, versionId]]);
  });

  it('requires both service identity and forwarded user JWT for internal decisions', async () => {
    const app = createApp(config, scriptedPool(() => ({ rows: [] })), { verifyJwt: () => Promise.resolve(actor) });
    const missingService = await request(app).post('/internal/v1/access-decisions')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId).send({ resourceClass: 'credit_business' });
    expect(missingService.status).toBe(401);
    expect(missingService.body).toMatchObject({ code: 'INVALID_SERVICE_IDENTITY' });

    const accepted = await request(app).post('/internal/v1/access-decisions')
      .set('Authorization', 'Bearer synthetic')
      .set('X-Request-Id', requestId)
      .set('X-Service-Token', config.serviceAuth.token)
      .send({ resourceClass: 'credit_business' });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ allowed: false, reason: 'NO_EFFECTIVE_VERSION' });
    expect(accepted.body).not.toHaveProperty('content');
  });
});
