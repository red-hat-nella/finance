#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RENDER="$(mktemp)"
trap 'rm -f "$RENDER"' EXIT
oc kustomize "$ROOT/deploy/openshift/overlays/dev" > "$RENDER"

RENDER="$RENDER" node --input-type=module <<'NODE'
import fs from 'node:fs';
import { parseAllDocuments } from 'yaml';
const resources = parseAllDocuments(fs.readFileSync(process.env.RENDER, 'utf8')).map((doc) => doc.toJSON()).filter(Boolean);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const podSpec = (resource) => resource.kind === 'CronJob' ? resource.spec?.jobTemplate?.spec?.template?.spec : resource.spec?.template?.spec;
for (const resource of resources.filter((item) => ['Deployment', 'StatefulSet', 'Job', 'CronJob'].includes(item.kind))) {
  const spec = podSpec(resource);
  assert(spec.automountServiceAccountToken === false, `${resource.kind}/${resource.metadata.name} automounts API token`);
  assert(spec.securityContext?.runAsNonRoot === true, `${resource.kind}/${resource.metadata.name} is not non-root`);
  assert(spec.securityContext?.seccompProfile?.type === 'RuntimeDefault', `${resource.kind}/${resource.metadata.name} lacks RuntimeDefault`);
  for (const container of spec.containers ?? []) {
    assert(container.securityContext?.allowPrivilegeEscalation === false, `${resource.metadata.name}/${container.name} allows privilege escalation`);
    assert(container.securityContext?.capabilities?.drop?.includes('ALL'), `${resource.metadata.name}/${container.name} does not drop ALL`);
    assert(container.securityContext?.runAsUser === undefined, `${resource.metadata.name}/${container.name} fixes UID`);
    if (resource.metadata.name !== 'postgres') assert(container.securityContext?.readOnlyRootFilesystem === true, `${resource.metadata.name}/${container.name} root filesystem is writable`);
  }
  for (const volume of spec.volumes ?? []) {
    if (volume.secret) throw new Error(`${resource.metadata.name} uses an unscoped Secret volume`);
    if (volume.projected) {
      assert(volume.projected.defaultMode === 256, `${resource.metadata.name} projected Secret mode must be 0400`);
      for (const source of volume.projected.sources ?? []) {
        if (source.secret) assert((source.secret.items ?? []).length > 0, `${resource.metadata.name} projects all Secret keys`);
      }
    }
  }
}
assert(!resources.some((resource) => ['Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding'].includes(resource.kind)), 'workloads require no Kubernetes RBAC');
NODE

echo "Workload restricted-v2 and least privilege: PASS"
