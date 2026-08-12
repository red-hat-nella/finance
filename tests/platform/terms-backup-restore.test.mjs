import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('terms backup is external, encrypted, schema-scoped and separately credentialed', () => {
  const manifest = read('deploy/openshift/components/postgres-dev/backup.yaml');
  assert.match(manifest, /name: terms-backup/);
  assert.match(manifest, /pg_dump[^\n]*-U terms_backup[^\n]*-d terms --schema=terms/);
  assert.match(manifest, /openssl enc -aes-256-cbc/);
  assert.match(manifest, /name: terms-backup-target/);
  assert.match(manifest, /concurrencyPolicy: Forbid/);
});

test('isolated restore validates terms schema, cardinality, acceptances and authorization', () => {
  const verifier = read('scripts/platform/verify-backup-restore');
  assert.equal(statSync(path.join(root, 'scripts/platform/verify-backup-restore')).mode & 0o111, 0o111);
  for (const term of ['--scope', 'terms.schema_migrations', 'terms.terms_versions', 'terms.terms_acceptances', 'terms.terms_audit_events', 'currentVersionCardinality', 'authorization', 'smoke']) {
    assert.ok(verifier.includes(term), `missing ${term}`);
  }
  assert.doesNotMatch(verifier, /set -x|echo .*PASSWORD|cat .*secret/i);
});
