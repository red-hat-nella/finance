import { createHash } from 'node:crypto';

export const MIGRATION_LOCK_NAME = 'finance2-terms-schema-v1';
export const REQUIRED_MIGRATIONS = Object.freeze([
  '0001_terms_schema.sql',
  '0002_terms_versions.sql',
  '0003_terms_acceptances_audit.sql',
  '0004_terms_idempotency_grants.sql',
  '0005_terms_retention.sql',
]);

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}
