import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AcceptanceService } from '../../src/modules/acceptances/acceptance.service.js';
import {
  acceptanceId, acceptanceRow, actor, digest, idempotencyKey, scriptedPool, versionId, versionRow,
} from '../support/fixtures.js';

describe('atomic acceptance persistence', () => {
  it('replays the original evidence for the same key and request hash', async () => {
    const requestHash = createHash('sha256').update(`${versionId}:${digest}`).digest('hex');
    const pool = scriptedPool((sql, values) => {
      if (sql.startsWith('BEGIN') || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM terms.terms_idempotency_records')) {
        expect(values?.slice(0, 2)).toEqual([actor.actorId, actor.orgId]);
        return { rowCount: 1, rows: [{ request_sha256: requestHash, resource_id: acceptanceId }] };
      }
      if (sql.includes('FROM terms.terms_acceptances')) return { rows: [acceptanceRow] };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const result = await new AcceptanceService(pool, 'h'.repeat(32)).accept(
      actor, { versionId, contentSha256: digest }, idempotencyKey, '30000000-0000-4000-8000-000000000001',
    );
    expect(result).toMatchObject({ replayed: true, created: false, acceptance: { acceptanceId } });
  });

  it('turns duplicate/concurrent requests into one logical evidence and one audit event', async () => {
    let acceptanceInsert = 0;
    let auditInsert = 0;
    const fingerprints: string[] = [];
    const pool = scriptedPool((sql, values) => {
      if (sql.startsWith('BEGIN') || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM terms.terms_idempotency_records')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM terms.terms_versions')) return { rows: [versionRow] };
      if (sql.includes('FROM terms.terms_acceptances')) return { rows: [] };
      if (sql.includes('INSERT INTO terms.terms_acceptances')) {
        acceptanceInsert += 1;
        fingerprints.push(String(values?.[4]));
        return { rows: [{ ...acceptanceRow, created: acceptanceInsert === 1 }] };
      }
      if (sql.includes('INSERT INTO terms.terms_audit_events')) {
        auditInsert += 1;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO terms.terms_idempotency_records')) return { rowCount: 1, rows: [{ request_sha256: digest }] };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const service = new AcceptanceService(pool, 'h'.repeat(32));
    const results = await Promise.all([
      service.accept(actor, { versionId, contentSha256: digest }, idempotencyKey, '30000000-0000-4000-8000-000000000001'),
      service.accept(actor, { versionId, contentSha256: digest }, idempotencyKey, '30000000-0000-4000-8000-000000000002'),
    ]);
    expect(results.map((result) => result.acceptance.acceptanceId)).toEqual([acceptanceId, acceptanceId]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(auditInsert).toBe(1);
    expect(fingerprints).toHaveLength(2);
    expect(fingerprints.every((value) => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    expect(fingerprints).not.toContain(`${actor.orgId}:${actor.actorId}`);
  });

  it('rolls back and fails closed when durable persistence fails', async () => {
    const statements: string[] = [];
    const pool = scriptedPool((sql) => {
      statements.push(sql);
      if (sql.startsWith('BEGIN')) return { rows: [] };
      if (sql.includes('FROM terms.terms_idempotency_records')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM terms.terms_versions')) return { rows: [versionRow] };
      if (sql.includes('FROM terms.terms_acceptances')) return { rows: [] };
      if (sql.includes('INSERT INTO terms.terms_acceptances')) throw new Error('synthetic DB failure');
      return { rows: [] };
    });
    await expect(new AcceptanceService(pool, 'h'.repeat(32)).accept(
      actor, { versionId, contentSha256: digest }, idempotencyKey, '30000000-0000-4000-8000-000000000001',
    )).rejects.toMatchObject({ problem: { status: 503, code: 'ACCEPTANCE_PERSISTENCE_UNAVAILABLE' } });
    expect(statements).toContain('ROLLBACK');
    expect(statements.some((sql) => sql.startsWith('BEGIN ISOLATION LEVEL READ COMMITTED'))).toBe(true);
  });
});
