#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
for environment in dev production; do
  file="$ROOT/deploy/openshift/overlays/$environment/kustomization.yaml"
  grep -q 'digest: sha256:' "$file" || { echo "$environment does not pin image digests" >&2; exit 1; }
  if grep -Eq 'newTag:|:latest([[:space:]]|$)' "$file"; then
    echo "$environment contains mutable image reference" >&2
    exit 1
  fi
done
[[ -x "$ROOT/scripts/images/publish.sh" ]] || { echo "publish.sh missing" >&2; exit 1; }
if grep -Eq '(build|bud)[[:space:]]' "$ROOT/scripts/images/publish.sh"; then
  echo "publish must not rebuild images" >&2
  exit 1
fi
grep -q 'skopeo copy' "$ROOT/scripts/images/publish.sh"
echo "Immutable build-once promotion: PASS"
