import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/load-config.js';
import {
  adminActor, idempotencyKey, requestId, scriptedPool, versionId, versionRow,
} from '../support/fixtures.js';

const config = loadConfig({ NODE_ENV: 'test' });
const verifyJwt = () => Promise.resolve(adminActor);
const draft = { ...versionRow, state: 'DRAFT' as const, effective_at: null, published_at: null };
const scheduled = {
  ...draft,
  state: 'SCHEDULED' as const,
  effective_at: new Date('2027-01-01T00:00:00.000Z'),
  published_at: new Date('2026-08-12T12:00:00.000Z'),
};

function adminPool() {
  return scriptedPool((sql) => {
    if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('FROM terms.terms_idempotency_records')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('INSERT INTO terms.terms_versions')) return { rows: [draft] };
    if (sql.includes('FROM terms.terms_versions WHERE version_id')) return { rows: [draft] };
    if (sql.includes("state='SCHEDULED' AND version_id<>")) return { rows: [], rowCount: 0 };
    if (sql.includes("SET state='SCHEDULED'")) return { rows: [scheduled] };
    if (sql.includes("SET state='WITHDRAWN'")) return { rows: [{ ...draft, state: 'WITHDRAWN' }] };
    if (sql.includes('INSERT INTO terms.terms_audit_events')) return { rows: [] };
    if (sql.includes('INSERT INTO terms.terms_idempotency_records')) return { rows: [], rowCount: 1 };
    if (sql.includes('ORDER BY created_at')) return { rows: [draft] };
    throw new Error(`unexpected SQL: ${sql}`);
  });
}

describe('terms admin v1 contract', () => {
  it('lists, gets and creates a canonical immutable draft', async () => {
    const app = createApp(config, adminPool(), { verifyJwt });
    const list = await request(app).get('/v1/admin/versions')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId);
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ items: [{ versionId, state: 'DRAFT' }] });

    const detail = await request(app).get(`/v1/admin/versions/${versionId}`)
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId);
    expect(detail.status).toBe(200);

    const created = await request(app).post('/v1/admin/versions')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId)
      .set('Idempotency-Key', idempotencyKey)
      .send({ versionCode: 'SYNTHETIC-2026.1', title: 'Synthetic terms', contentFormat: 'markdown', content: '# Synthetic terms\r\n' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ versionId, state: 'DRAFT', contentFormat: 'markdown' });
  });

  it('schedules and withdraws only through idempotent commands', async () => {
    const app = createApp(config, adminPool(), { verifyJwt });
    const schedule = await request(app).post(`/v1/admin/versions/${versionId}/schedule`)
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId)
      .set('Idempotency-Key', idempotencyKey).send({ effectiveAt: '2027-01-01T00:00:00.000Z' });
    expect(schedule.status).toBe(200);
    expect(schedule.body).toMatchObject({ state: 'SCHEDULED', effectiveAt: '2027-01-01T00:00:00.000Z' });

    const withdraw = await request(app).post(`/v1/admin/versions/${versionId}/withdraw`)
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId)
      .set('Idempotency-Key', idempotencyKey).send();
    expect(withdraw.status).toBe(200);
    expect(withdraw.body).toMatchObject({ state: 'WITHDRAWN' });
  });

  it.each([
    [{ versionCode: 'bad code', title: '', contentFormat: 'markdown', content: '' }],
    [{ versionCode: 'SAFE-1', title: 'Unsafe', contentFormat: 'markdown', content: '<script>alert(1)</script>' }],
  ])('returns RFC 9457 validation without partial writes', async (body) => {
    const response = await request(createApp(config, adminPool(), { verifyJwt })).post('/v1/admin/versions')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId)
      .set('Idempotency-Key', idempotencyKey).send(body);
    expect(response.status).toBe(422);
    expect(response.type).toBe('application/problem+json');
  });
});
