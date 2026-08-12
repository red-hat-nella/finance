import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('release verifier covers migration, reconciliation, rollout, persistence and digests', () => {
  const source = read('scripts/platform/verify-terms-release');
  assert.equal(statSync(path.join(root, 'scripts/platform/verify-terms-release')).mode & 0o111, 0o111);
  for (const term of ['terms-migrations', 'reconciliation', 'rollout status', 'persistence', '@sha256', 'terms-gate.sh']) assert.ok(source.includes(term));
  assert.doesNotMatch(source, /oc\s+(?:apply|delete|set image|rollout undo)/);
});

test('rollback is GitOps-only and never performs down migration or data restore', () => {
  const source = read('scripts/platform/rollback');
  assert.match(source, /gitops-revert/);
  assert.match(source, /no-down-migration-no-data-restore/);
  assert.match(source, /images\.termsWeb.*images\.termsApi/s);
  assert.doesNotMatch(source, /oc\s+(?:apply|delete|set image|rollout undo)|pg_restore|DROP TABLE/i);
});
