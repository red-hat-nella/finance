#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

"$ROOT/scripts/platform/render" --all --output-dir "$TMP/rendered"
"$ROOT/scripts/platform/validate" --all --cluster-version 4.21.21 --evidence-dir "$TMP/evidence"
node "$ROOT/scripts/platform/report.mjs" --offline --environment dev \
  --render-dir "$TMP/rendered/dev" --output "$TMP/release.json"
node "$ROOT/scripts/platform/validate-contracts.mjs" \
  --schema deployment-evidence.schema.json --document "$TMP/release.json"
jq -e '.checks | any(.type=="reconcile" and .result=="PENDING_VALIDATION")' "$TMP/release.json" >/dev/null
echo "Offline release evidence: PASS"
