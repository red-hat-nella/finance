import type pg from 'pg';
import type { ActorContext } from '../../src/http/middleware/request-context.js';

export const actor: ActorContext = Object.freeze({
  actorId: 'synthetic-analyst-001',
  orgId: 'synthetic-org-alpha',
  roles: Object.freeze(['credit_analyst'] as const),
});
export const adminActor: ActorContext = Object.freeze({
  actorId: 'synthetic-terms-admin-001',
  orgId: 'synthetic-org-control',
  roles: Object.freeze(['terms_admin'] as const),
});
export const versionId = '10000000-0000-4000-8000-000000000001';
export const acceptanceId = '20000000-0000-4000-8000-000000000001';
export const idempotencyKey = '40000000-0000-4000-8000-000000000001';
export const requestId = '30000000-0000-4000-8000-000000000001';
export const digest = 'a'.repeat(64);
export const versionRow = {
  version_id: versionId,
  version_code: 'SYNTHETIC-2026.1',
  title: 'Synthetic terms',
  content_format: 'markdown' as const,
  content_source: '# Synthetic terms',
  content_sha256: digest,
  state: 'EFFECTIVE' as const,
  effective_at: new Date('2026-01-02T00:00:00.000Z'),
  published_at: new Date('2026-01-01T12:00:00.000Z'),
};
export const acceptanceRow = {
  acceptance_id: acceptanceId,
  version_id: versionId,
  version_code: 'SYNTHETIC-2026.1',
  accepted_at: new Date('2026-01-02T08:30:00.000Z'),
  content_sha256: digest,
  created: true,
};

export function scriptedPool(handler: (sql: string, values?: readonly unknown[]) => unknown): pg.Pool {
  const client = {
    query: (sql: string, values?: readonly unknown[]) => Promise.resolve(handler(sql, values)),
    release: () => undefined,
  };
  return {
    query: client.query,
    connect: () => Promise.resolve(client),
  } as unknown as pg.Pool;
}
