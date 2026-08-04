#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
render="$(mktemp)"; trap 'rm -f "$render"' EXIT
kubectl kustomize "$ROOT/deploy/openshift/overlays/dev" > "$render"
[[ "$(grep -c '^kind: Route$' "$render")" -eq 1 ]]
grep -q 'readOnlyRootFilesystem: true' "$render"
grep -q 'allowPrivilegeEscalation: false' "$render"
grep -q 'kind: NetworkPolicy' "$render"
grep -q 'readinessProbe:' "$render"
! grep -Eiq 'password: (changeme|password|secret)$' "$render"
echo 'Políticas OpenShift: PASS'
