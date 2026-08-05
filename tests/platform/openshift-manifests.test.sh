#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV="$(mktemp)"
PROD="$(mktemp)"
trap 'rm -f "$DEV" "$PROD"' EXIT

kubectl kustomize "$ROOT/deploy/openshift/overlays/dev" > "$DEV"
kubectl kustomize "$ROOT/deploy/openshift/overlays/production" > "$PROD"

DEV_RENDER="$DEV" PROD_RENDER="$PROD" node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { parseAllDocuments } from 'yaml';

function documents(path) {
  return parseAllDocuments(readFileSync(path, 'utf8')).map((doc) => doc.toJSON()).filter(Boolean);
}
function assert(value, message) {
  if (!value) throw new Error(message);
}
function named(docs, kind, name) {
  return docs.find((doc) => doc.kind === kind && doc.metadata?.name === name);
}
function podSpec(resource) {
  if (['Deployment', 'StatefulSet', 'Job'].includes(resource.kind)) return resource.spec?.template?.spec;
  if (resource.kind === 'CronJob') return resource.spec?.jobTemplate?.spec?.template?.spec;
  return undefined;
}

const dev = documents(process.env.DEV_RENDER);
const prod = documents(process.env.PROD_RENDER);
const routes = dev.filter((doc) => doc.kind === 'Route');
assert(routes.length === 1 && routes[0].metadata.name === 'frontend', 'exactly one frontend Route is required');
assert(routes[0].spec?.tls?.insecureEdgeTerminationPolicy === 'Redirect', 'Route must redirect HTTP to TLS');
for (const name of ['frontend', 'ingestion', 'scoring']) {
  const deployment = named(dev, 'Deployment', name);
  assert(deployment?.spec?.replicas === 2, `${name} must have two replicas`);
  assert(deployment.spec.template.spec.containers[0].livenessProbe, `${name} liveness probe missing`);
  assert(deployment.spec.template.spec.containers[0].readinessProbe, `${name} readiness probe missing`);
}
for (const resource of dev.filter((doc) => podSpec(doc))) {
  const spec = podSpec(resource);
  assert(spec.securityContext?.runAsNonRoot === true, `${resource.kind}/${resource.metadata.name} must run non-root`);
  assert(spec.securityContext?.seccompProfile?.type === 'RuntimeDefault', `${resource.kind}/${resource.metadata.name} needs RuntimeDefault seccomp`);
  for (const container of spec.containers ?? []) {
    assert(container.securityContext?.allowPrivilegeEscalation === false, `${resource.metadata.name}/${container.name} allows privilege escalation`);
    assert(container.securityContext?.capabilities?.drop?.includes('ALL'), `${resource.metadata.name}/${container.name} must drop ALL capabilities`);
    assert(container.securityContext?.runAsUser === undefined, `${resource.metadata.name}/${container.name} fixes a UID`);
    assert(container.resources?.requests?.cpu && container.resources?.requests?.memory, `${resource.metadata.name}/${container.name} requests missing`);
    assert(container.resources?.limits?.cpu && container.resources?.limits?.memory, `${resource.metadata.name}/${container.name} limits missing`);
    assert(!String(container.image).endsWith(':latest'), `${resource.metadata.name}/${container.name} uses latest`);
  }
}
assert(named(dev, 'PersistentVolumeClaim', 'postgres-data')?.spec?.resources?.requests?.storage === '5Gi', 'demo PostgreSQL PVC must be 5Gi');
assert(named(dev, 'Job', 'migrations'), 'migration Job missing');
for (const name of ['retention', 'reconciler']) {
  const cron = named(dev, 'CronJob', name);
  assert(cron?.spec?.concurrencyPolicy === 'Forbid', `${name} must forbid concurrency`);
}
const policyNames = new Set(dev.filter((doc) => doc.kind === 'NetworkPolicy').map((doc) => doc.metadata.name));
for (const name of ['default-deny', 'allow-cluster-dns', 'router-to-frontend', 'frontend-to-ingestion', 'ingestion-to-scoring-and-database', 'scoring-from-ingestion', 'database-jobs-to-postgres'])
  assert(policyNames.has(name), `NetworkPolicy ${name} missing`);
assert(dev.filter((doc) => doc.kind === 'Secret').length === 0, 'real Secret manifests must not be rendered');
assert(!dev.some((doc) => doc.kind === 'Service' && ['NodePort', 'LoadBalancer'].includes(doc.spec?.type)), 'internal services must not be public');
assert(!prod.some((doc) => doc.kind === 'StatefulSet' && doc.metadata.name === 'postgres'), 'production must not deploy demo PostgreSQL');
assert(!prod.some((doc) => doc.kind === 'PersistentVolumeClaim' && doc.metadata.name === 'postgres-data'), 'production must not deploy demo storage');
assert(named(prod, 'Service', 'external-postgres')?.spec?.type === 'ExternalName', 'production external database service missing');
NODE

echo "OpenShift restricted-v2, topology, probes, resources and policies: PASS"
