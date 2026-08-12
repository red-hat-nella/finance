import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseAllDocuments } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => parseAllDocuments(fs.readFileSync(path.join(root, relative), 'utf8')).map((doc) => doc.toJSON()).filter(Boolean);

for (const name of ['terms-web', 'terms-api']) {
  test(`${name} has restricted-v2 compatible lifecycle`, () => {
    const deployment = read(`deploy/openshift/base/${name}/deployment.yaml`)[0];
    const pod = deployment.spec.template.spec;
    const container = pod.containers[0];
    assert.equal(deployment.apiVersion, 'apps/v1');
    assert.equal(deployment.spec.replicas, 2);
    assert.equal(deployment.spec.strategy.rollingUpdate.maxUnavailable, 0);
    assert.equal(pod.automountServiceAccountToken, false);
    assert.equal(pod.securityContext.runAsNonRoot, true);
    assert.equal(pod.securityContext.seccompProfile.type, 'RuntimeDefault');
    assert.equal(container.securityContext.allowPrivilegeEscalation, false);
    assert.equal(container.securityContext.readOnlyRootFilesystem, true);
    assert.ok(container.securityContext.capabilities.drop.includes('ALL'));
    assert.ok(container.livenessProbe && container.readinessProbe);
    assert.ok(container.resources.requests && container.resources.limits);
    assert.match(container.image, /@sha256:[a-f0-9]{64}$/);
    assert.equal(container.securityContext.runAsUser, undefined);
  });
  test(`${name} is internal and has disruption protection`, () => {
    const service = read(`deploy/openshift/base/${name}/service.yaml`)[0];
    const pdb = read(`deploy/openshift/base/${name}/pdb.yaml`)[0];
    assert.equal(service.spec.type, 'ClusterIP');
    assert.equal(pdb.apiVersion, 'policy/v1');
    assert.equal(pdb.spec.minAvailable, 1);
  });
}

test('terms adds no Route, PVC or Secret manifest', () => {
  for (const name of ['terms-web', 'terms-api']) {
    const files = fs.readdirSync(path.join(root, `deploy/openshift/base/${name}`));
    assert.equal(files.some((file) => /route|pvc|secret/i.test(file)), false);
  }
});
