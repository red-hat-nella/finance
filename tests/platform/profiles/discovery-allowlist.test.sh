#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/platform/discover"

[[ -x "$SCRIPT" ]] || { echo "discover must be executable" >&2; exit 1; }

if grep -Eiq 'oc[[:space:]].*(get|list)[[:space:]].*secret|kubectl[[:space:]].*(get|list)[[:space:]].*secret|configuration_view|config[[:space:]]+view' "$SCRIPT"; then
  echo "discovery attempts to read Secrets or kubeconfig" >&2
  exit 1
fi

for allowed in clusterversion api-resources resourcequota limitrange storageclass routes auth; do
  grep -qi "$allowed" "$SCRIPT" || { echo "missing allowlisted discovery: $allowed" >&2; exit 1; }
done

grep -q 'validate-contracts.mjs' "$SCRIPT"
echo "Discovery allowlist: PASS"
