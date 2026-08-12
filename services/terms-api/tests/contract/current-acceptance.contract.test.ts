import { createHash } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/load-config.js';
import {
  acceptanceRow, actor, digest, idempotencyKey, requestId, scriptedPool, versionId, versionRow,
} from '../support/fixtures.js';

const config = loadConfig({ NODE_ENV: 'test' });
const verifyJwt = () => Promise.resolve(actor);

describe('terms public v1 current and acceptance contract', () => {
  it('returns the exact current document, own status and digest ETag', async () => {
    const pool = scriptedPool((sql) => {
      if (sql.includes('FROM terms.terms_versions')) return { rows: [versionRow] };
      if (sql.includes('FROM terms.terms_acceptances')) return { rows: [] };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const response = await request(createApp(config, pool, { verifyJwt }))
      .get('/v1/current').set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId);
    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe(`"sha256-${digest}"`);
    expect(response.body).toMatchObject({
      version: { versionId, contentSha256: digest, content: '# Synthetic terms' },
      acceptanceStatus: 'PENDING',
      acceptedAt: null,
    });
  });

  it('creates once and exposes idempotency response metadata', async () => {
    const pool = scriptedPool((sql) => {
      if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM terms.terms_idempotency_records')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM terms.terms_versions')) return { rows: [versionRow] };
      if (sql.includes('FROM terms.terms_acceptances')) return { rows: [] };
      if (sql.includes('INSERT INTO terms.terms_acceptances')) return { rows: [acceptanceRow] };
      if (sql.includes('INSERT INTO terms.terms_audit_events')) return { rows: [] };
      if (sql.includes('INSERT INTO terms.terms_idempotency_records')) return { rowCount: 1, rows: [{ request_sha256: digest }] };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const response = await request(createApp(config, pool, { verifyJwt }))
      .post('/v1/acceptances')
      .set('Authorization', 'Bearer synthetic')
      .set('X-Request-Id', requestId)
      .set('Idempotency-Key', idempotencyKey)
      .send({ versionId, contentSha256: digest });
    expect(response.status).toBe(201);
    expect(response.headers['idempotency-replayed']).toBe('false');
    expect(response.body).toMatchObject({ acceptanceId: acceptanceRow.acceptance_id, versionId, contentSha256: digest });
  });

  it('replays the same acceptance and rejects key reuse with another body', async () => {
    const requestHash = createHash('sha256').update(`${versionId}:${digest}`).digest('hex');
    const pool = scriptedPool((sql) => {
      if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM terms.terms_idempotency_records')) {
        return { rowCount: 1, rows: [{ request_sha256: requestHash, resource_id: acceptanceRow.acceptance_id }] };
      }
      if (sql.includes('FROM terms.terms_acceptances')) return { rows: [acceptanceRow] };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const app = createApp(config, pool, { verifyJwt });
    const replay = await request(app).post('/v1/acceptances')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId)
      .set('Idempotency-Key', idempotencyKey).send({ versionId, contentSha256: digest });
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');

    const conflictResponse = await request(app).post('/v1/acceptances')
      .set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId)
      .set('Idempotency-Key', idempotencyKey).send({ versionId, contentSha256: 'b'.repeat(64) });
    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it.each([
    [{ versionId: 'not-a-uuid', contentSha256: digest }, idempotencyKey],
    [{ versionId, contentSha256: 'bad' }, idempotencyKey],
    [{ versionId, contentSha256: digest }, 'not-a-uuid'],
  ])('returns RFC 9457 validation for invalid input', async (body, key) => {
    const response = await request(createApp(config, scriptedPool(() => ({ rows: [] })), { verifyJwt }))
      .post('/v1/acceptances').set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId).set('Idempotency-Key', key).send(body);
    expect(response.status).toBe(422);
    expect(response.type).toBe('application/problem+json');
    expect(response.body).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', retryable: false });
  });

  it('rejects an obsolete digest/version without writing evidence', async () => {
    let writes = 0;
    const pool = scriptedPool((sql) => {
      if (sql.startsWith('BEGIN') || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM terms.terms_idempotency_records')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM terms.terms_versions')) return { rows: [versionRow] };
      if (sql.includes('INSERT')) writes += 1;
      return { rows: [] };
    });
    const response = await request(createApp(config, pool, { verifyJwt }))
      .post('/v1/acceptances').set('Authorization', 'Bearer synthetic').set('X-Request-Id', requestId).set('Idempotency-Key', idempotencyKey)
      .send({ versionId, contentSha256: 'b'.repeat(64) });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'TERMS_VERSION_CHANGED' });
    expect(writes).toBe(0);
  });
});
