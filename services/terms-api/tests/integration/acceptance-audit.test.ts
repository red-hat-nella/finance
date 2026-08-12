import { describe, expect, it } from 'vitest';
import { AcceptanceAuditService } from '../../src/modules/audit/acceptance-audit.service.js';
import { actor, acceptanceId, digest, scriptedPool, versionId } from '../support/fixtures.js';

describe('organization-scoped audit persistence', () => {
  it('always binds JWT organization, fingerprint and keyset pagination', async () => {
    let values: readonly unknown[] = [];
    const pool = scriptedPool((_sql, parameters) => { values = parameters ?? []; return { rows: [] }; });
    const service = new AcceptanceAuditService(pool, 'h'.repeat(32));
    await service.search(actor, {
      actorPublicId: 'synthetic-analyst-001', versionCode: 'SYNTHETIC-2026.1',
      from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z', limit: 25,
    });
    expect(values[0]).toBe(actor.orgId);
    expect(values[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(values).not.toContain('synthetic-analyst-001');
    expect(values.at(-1)).toBe(26);
  });

  it('returns no partial evidence when PostgreSQL fails', async () => {
    const pool = scriptedPool(() => { throw new Error('synthetic DB failure'); });
    await expect(new AcceptanceAuditService(pool, 'h'.repeat(32)).search(actor, { limit: 25 }))
      .rejects.toMatchObject({ problem: { status: 503, code: 'AUDIT_SEARCH_UNAVAILABLE' } });
  });

  it('produces a cursor only after a complete limit+1 page', async () => {
    const pool = scriptedPool(() => ({ rows: [
      { acceptance_id: acceptanceId, version_id: versionId, version_code: 'SYNTHETIC-1', accepted_at: new Date('2026-01-02Z'), content_sha256: digest, actor_id: 'synthetic-001' },
      { acceptance_id: '20000000-0000-4000-8000-000000000002', version_id: versionId, version_code: 'SYNTHETIC-1', accepted_at: new Date('2026-01-01Z'), content_sha256: digest, actor_id: 'synthetic-002' },
    ] }));
    const result = await new AcceptanceAuditService(pool, 'h'.repeat(32)).search(actor, { limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});
