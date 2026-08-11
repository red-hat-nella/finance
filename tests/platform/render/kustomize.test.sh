#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for environment in dev production; do
  oc kustomize "$ROOT/deploy/openshift/overlays/$environment" > "$TMP/$environment.yaml"
  [[ -s "$TMP/$environment.yaml" ]] || { echo "$environment rendered empty" >&2; exit 1; }
done

ROOT="$ROOT" TMP="$TMP" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import { parseAllDocuments } from 'yaml';

const read = (environment) => parseAllDocuments(fs.readFileSync(path.join(process.env.TMP, `${environment}.yaml`), 'utf8')).map((doc) => doc.toJSON()).filter(Boolean);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const dev = read('dev');
const production = read('production');
for (const resource of [...dev, ...production]) {
  assert(resource.apiVersion && resource.kind && resource.metadata?.name, 'rendered resource is incomplete');
}
assert(dev.every((resource) => resource.metadata.namespace === 'rh-ee-mpolo-dev' || ['Namespace', 'ClusterRole', 'ClusterRoleBinding'].includes(resource.kind)), 'dev namespace must be rh-ee-mpolo-dev');
assert(dev.some((resource) => resource.kind === 'StatefulSet' && resource.metadata.name === 'postgres'), 'dev PostgreSQL component missing');
assert(dev.some((resource) => resource.kind === 'PersistentVolumeClaim' && resource.metadata.name === 'postgres-data'), 'dev PostgreSQL PVC missing');
assert(!production.some((resource) => resource.kind === 'StatefulSet' && resource.metadata.name === 'postgres'), 'production must not include PostgreSQL StatefulSet');
assert(!production.some((resource) => resource.kind === 'PersistentVolumeClaim' && resource.metadata.name === 'postgres-data'), 'production must not include PostgreSQL PVC');
for (const resources of [dev, production]) {
  const routes = resources.filter((resource) => resource.kind === 'Route');
  assert(routes.length === 1 && routes[0].metadata.name === 'frontend', 'only frontend Route is allowed');
  assert(resources.filter((resource) => resource.kind === 'Secret').length === 0, 'render must not contain Secret objects');
}
NODE

echo "Kustomize overlays and references: PASS"
