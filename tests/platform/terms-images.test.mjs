import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseDocument } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

for (const [name, dockerfile] of [['terms-web', 'apps/terms-web/Dockerfile'], ['terms-api', 'services/terms-api/Dockerfile']]) {
  test(`${name} image is non-root, reproducible and read-only compatible`, () => {
    const source = read(dockerfile);
    assert.match(source, /USER\s+(?:1001|[1-9][0-9]{3,})/);
    assert.doesNotMatch(source, /latest|npm install(?!\s+--)/);
    assert.match(source, /npm ci/);
    assert.match(source, /HEALTHCHECK/);
  });
}

test('terms workload promotion is digest-only and linked to two image identities', () => {
  for (const overlay of ['dev', 'production']) {
    const source = read(`deploy/openshift/overlays/${overlay}/kustomization.yaml`);
    for (const image of ['terms-web', 'terms-api']) {
      assert.match(source, new RegExp(`name: quay\\.io/finance2/${image}[\\s\\S]*?digest: sha256:[a-f0-9]{64}`));
    }
  }
});

test('deployed terms containers enforce read-only root and arbitrary UID constraints', () => {
  for (const name of ['terms-web', 'terms-api']) {
    const deployment = parseDocument(read(`deploy/openshift/base/${name}/deployment.yaml`)).toJSON();
    const container = deployment.spec.template.spec.containers[0];
    assert.equal(container.securityContext.readOnlyRootFilesystem, true);
    assert.equal(container.securityContext.runAsUser, undefined);
    assert.equal(container.securityContext.allowPrivilegeEscalation, false);
    assert.deepEqual(container.securityContext.capabilities.drop, ['ALL']);
  }
});

test('delivery pipeline declares SBOM, vulnerability and commit-link gates for terms images', () => {
  const sources = [
    '.tekton/pipeline.yaml',
    '.tekton/tasks/publish.yaml',
    'scripts/images/build-all.sh',
  ].map((file) => read(file)).join('\n');
  for (const image of ['terms-web', 'terms-api']) assert.ok(sources.includes(image));
  assert.match(sources, /sbom|syft/i);
  assert.match(sources, /critical|vulnerab|grype/i);
  assert.match(sources, /commit-sha|revision/i);
  assert.match(sources, /sha256|digest/i);
});
