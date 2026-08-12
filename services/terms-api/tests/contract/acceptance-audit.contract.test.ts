import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/load-config.js';
import type { ActorContext } from '../../src/http/middleware/request-context.js';
import {
  acceptanceId, actor, digest, requestId, scriptedPool, versionId,
} from '../support/fixtures.js';

const config = loadConfig({ NODE_ENV: 'test' });
const auditor: ActorContext = { ...actor, roles: ['auditor'] };
const acceptedAt = new Date('2026-01-02T08:30:00.000Z');

describe('acceptance audit search contract', () => {
  it('returns masked evidence, a strict opaque cursor and supports an empty page', async () => {
    let calls = 0;
    const pool = scriptedPool((sql) => {
      if (!sql.includes('FROM terms.terms_acceptances')) throw new Error(`unexpected SQL: ${sql}`);
      calls += 1;
      return calls === 1 ? { rows: [
        { acceptance_id: acceptanceId, version_id: versionId, version_code: 'SYNTHETIC-2026.1', accepted_at: acceptedAt, content_sha256: digest, actor_id: 'synthetic-analyst-001' },
        { acceptance_id: '20000000-0000-4000-8000-000000000002', version_id: versionId, version_code: 'SYNTHETIC-2026.1', accepted_at: new Date('2026-01-01T00:00:00Z'), content_sha256: digest, actor_id: 'synthetic-analyst-002' },
      ] } : { rows: [] };
    });
    const app = createApp(config, pool, { verifyJwt: () => Promise.resolve(auditor) });
    const first = await request(app).post('/v1/audit/acceptances/search')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId).send({ limit: 1 });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ items: [{ acceptanceId, actorDisplay: '••••-001' }] });
    expect(JSON.stringify(first.body)).not.toContain('synthetic-analyst-001');
    const nextCursor = (first.body as { nextCursor?: unknown }).nextCursor;
    expect(typeof nextCursor).toBe('string');
    const second = await request(app).post('/v1/audit/acceptances/search')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId).send({ cursor: nextCursor });
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ items: [], nextCursor: null });
  });

  it.each([
    { limit: 0 }, { limit: 101 }, { from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
    { cursor: 'tampered.payload' }, { actorPublicId: 'x'.repeat(129) }, { extra: true },
  ])('rejects invalid filters and altered cursors with RFC 9457', async (body) => {
    const response = await request(createApp(config, scriptedPool(() => ({ rows: [] })), {
      verifyJwt: () => Promise.resolve(auditor),
    })).post('/v1/audit/acceptances/search').set('Authorization', 'Bearer synthetic')
      .set('X-Request-Id', requestId).send(body);
    expect(response.status).toBe(422);
    expect(response.type).toBe('application/problem+json');
  });
});
