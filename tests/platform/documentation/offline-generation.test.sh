#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DOC="$(mktemp)"; trap 'rm -f "$DOC"' EXIT
"$ROOT/scripts/platform/generate-operations-doc" --offline --render-root "$ROOT/build/rendered" --output "$DOC"
grep -q 'Inventario dev' "$DOC"
grep -q 'Inventario production' "$DOC"
grep -q 'PENDING_VALIDATION' "$DOC"
(cd "$ROOT" && "$ROOT/scripts/platform/validate-operations-doc" "$DOC")
echo "Offline operations documentation: PASS"
