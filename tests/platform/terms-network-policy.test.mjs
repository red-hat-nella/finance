import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseAllDocuments } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const docs = parseAllDocuments(
  fs.readFileSync(path.join(root, 'deploy/openshift/base/network/terms.yaml'), 'utf8'),
).map((doc) => doc.toJSON()).filter(Boolean);
const byName = new Map(docs.map((doc) => [doc.metadata.name, doc]));

test('terms communication graph is explicitly allowlisted', () => {
  for (const name of ['frontend-to-terms', 'terms-web-from-frontend', 'terms-api-from-consumers', 'ingestion-to-terms-api', 'terms-api-to-postgres', 'postgres-from-terms-api', 'terms-api-to-jwks']) {
    assert.ok(byName.has(name), `missing ${name}`);
  }
  assert.deepEqual(byName.get('terms-web-from-frontend').spec.egress, []);
  const rendered = JSON.stringify(docs);
  assert.doesNotMatch(rendered, /0\.0\.0\.0\/0|NodePort|LoadBalancer/);
  assert.doesNotMatch(rendered, /app\.kubernetes\.io\/name":"scoring/);
});

test('external JWKS egress is explicit and remains pending platform validation', () => {
  const policy = byName.get('terms-api-to-jwks');
  assert.equal(policy.metadata.annotations['platform.finance2/state'], 'PENDING_VALIDATION');
  assert.equal(policy.spec.egress[0].ports[0].port, 443);
  assert.match(policy.spec.egress[0].to[0].ipBlock.cidr, /^198\.51\.100\./);
});

test('only frontend and ingestion can reach terms-api', () => {
  const ingress = byName.get('terms-api-from-consumers').spec.ingress[0].from;
  const names = ingress.map((item) => item.podSelector.matchLabels['app.kubernetes.io/name']).sort();
  assert.deepEqual(names, ['frontend', 'ingestion']);
});
