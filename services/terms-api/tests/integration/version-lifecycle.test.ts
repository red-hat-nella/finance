import { describe, expect, it } from 'vitest';
import { contentDigest } from '../../src/modules/versions/content-digest.js';
import { VersionAdminService } from '../../src/modules/versions/version-admin.service.js';
import { assertSchedulable, assertWithdrawable } from '../../src/modules/versions/version-lifecycle.js';
import {
  adminActor, idempotencyKey, requestId, scriptedPool, versionId, versionRow,
} from '../support/fixtures.js';

const draft = {
  versionId,
  versionCode: versionRow.version_code,
  title: versionRow.title,
  contentFormat: versionRow.content_format,
  content: versionRow.content_source,
  contentSha256: versionRow.content_sha256,
  state: 'DRAFT' as const,
  effectiveAt: null,
  publishedAt: null,
};

describe('controlled-clock version lifecycle', () => {
  it('canonicalizes digest deterministically and rejects dangerous Markdown', () => {
    expect(contentDigest('# Términos\r\n\r\nTexto   \r\n')).toBe(contentDigest('# Te\u0301rminos\n\nTexto'));
    expect(() => contentDigest('<img src=x onerror=alert(1)>')).toThrow();
    expect(() => contentDigest('[x](javascript:alert(1))')).toThrow();
  });

  it('enforces DRAFT -> SCHEDULED and forbids published mutation/withdrawal', () => {
    const now = new Date('2026-08-12T12:00:00.000Z');
    expect(() => { assertSchedulable(draft, new Date('2026-08-12T11:59:59.000Z'), now); }).toThrow();
    expect(() => { assertSchedulable({ ...draft, state: 'EFFECTIVE' }, new Date('2027-01-01T00:00:00Z'), now); }).toThrow();
    expect(() => { assertWithdrawable({ ...draft, state: 'EFFECTIVE' }, now); }).toThrow();
  });

  it('serializes scheduling and rejects overlap before any state update', async () => {
    const statements: string[] = [];
    const pool = scriptedPool((sql) => {
      statements.push(sql);
      if (sql.startsWith('BEGIN') || sql === 'ROLLBACK' || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('FROM terms.terms_idempotency_records')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM terms.terms_versions WHERE version_id')) return { rows: [{ ...versionRow, state: 'DRAFT', effective_at: null, published_at: null }] };
      if (sql.includes("state='SCHEDULED' AND version_id<>")) return { rows: [{}], rowCount: 1 };
      return { rows: [] };
    });
    const service = new VersionAdminService(pool, undefined, undefined, () => new Date('2026-08-12T12:00:00Z'));
    await expect(service.schedule(adminActor, versionId, { effectiveAt: '2027-01-01T00:00:00Z' }, idempotencyKey, requestId))
      .rejects.toMatchObject({ problem: { code: 'VERSION_OVERLAP' } });
    expect(statements.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(statements.some((sql) => sql.includes("SET state='SCHEDULED'"))).toBe(false);
  });

  it('supersedes the prior effective version and promotes the due version atomically', async () => {
    const statements: string[] = [];
    const due = { ...versionRow, state: 'SCHEDULED' as const, version_id: '10000000-0000-4000-8000-000000000002' };
    const pool = scriptedPool((sql) => {
      statements.push(sql);
      if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes("state IN ('EFFECTIVE'")) return { rows: [versionRow] };
      if (sql.includes("WHERE state='SCHEDULED' AND effective_at")) return { rows: [due] };
      if (sql.includes("SET state='SUPERSEDED'")) return { rows: [] };
      if (sql.includes("SET state='EFFECTIVE'")) return { rows: [{ ...due, state: 'EFFECTIVE' }] };
      if (sql.includes('INSERT INTO terms.terms_audit_events')) return { rows: [] };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const result = await new VersionAdminService(pool).promoteDue(adminActor, requestId);
    expect(result?.state).toBe('EFFECTIVE');
    expect(statements.findIndex((sql) => sql.includes("SET state='SUPERSEDED'")))
      .toBeLessThan(statements.findIndex((sql) => sql.includes("SET state='EFFECTIVE'")));
    expect(statements.at(-1)).toBe('COMMIT');
  });
});
