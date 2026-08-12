import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/load-config.js';
import type { ActorContext } from '../../src/http/middleware/request-context.js';
import { actor, idempotencyKey, requestId, scriptedPool } from '../support/fixtures.js';

const config = loadConfig({ NODE_ENV: 'test' });
const body = { versionCode: 'SYNTHETIC-1', title: 'Synthetic', contentFormat: 'markdown', content: '# Synthetic' };

describe('terms administration authorization', () => {
  it.each([
    actor,
    { ...actor, roles: ['supervisor'] as const },
    { ...actor, roles: ['auditor'] as const },
  ])('denies non-admin mutation for $roles', async (candidate) => {
    let queried = false;
    const response = await request(createApp(config, scriptedPool(() => { queried = true; return { rows: [] }; }), {
      verifyJwt: () => Promise.resolve(candidate),
    })).post('/v1/admin/versions').set('Authorization', 'Bearer synthetic')
      .set('X-Request-Id', requestId).set('Idempotency-Key', idempotencyKey).send(body);
    expect(response.status).toBe(403);
    expect(queried).toBe(false);
  });

  it.each(['terms_admin', 'supervisor', 'auditor'] as const)('allows %s to read control-plane data without a current version', async (role) => {
    const candidate: ActorContext = { ...actor, roles: [role] };
    const response = await request(createApp(config, scriptedPool((sql) => {
      if (sql.includes('ORDER BY created_at')) return { rows: [] };
      throw new Error(`current-version query is forbidden: ${sql}`);
    }), { verifyJwt: () => Promise.resolve(candidate) })).get('/v1/admin/versions')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ items: [] });
  });
});
