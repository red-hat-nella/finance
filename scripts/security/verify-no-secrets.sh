#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

failed=0
while IFS= read -r path; do
  if [[ -e "$path" ]]; then
    printf 'ERROR: secreto local versionado presente: %s\n' "$path" >&2
    failed=1
  fi
done < <(git ls-files 'deploy/local/.secrets/*')

if git grep -IEn -- '-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' -- . \
  ':(exclude)**/node_modules/**' ':(exclude)package-lock.json' \
  ':(exclude)services/scoring/uv.lock'; then
  printf 'ERROR: patrón de credencial real encontrado en archivos versionados.\n' >&2
  failed=1
fi

render="$(mktemp)"
trap 'rm -f "$render"' EXIT
kubectl kustomize deploy/openshift/overlays/dev > "$render"
if grep -Eq '^kind: Secret$|REPLACE_USING_CREATE_SECRETS_SCRIPT|private-key|scoring-service-token: [^/]' "$render"; then
  printf 'ERROR: el render de OpenShift contiene material secreto o sentinelas.\n' >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then exit 1; fi
echo "Secretos, tokens y manifiestos sin credenciales reales: PASS"
