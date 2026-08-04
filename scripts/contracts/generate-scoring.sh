#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT/specs/001-alternative-credit-scoring/contracts/scoring-internal-v1.openapi.yaml"
OUTPUT="$ROOT/services/ingestion/src/generated/scoring/index.ts"
mkdir -p "$(dirname "$OUTPUT")"

if [[ "${1:-}" == "--check" ]]; then
  temporary="$(mktemp "$(dirname "$OUTPUT")/.generated.XXXXXX.ts")"
  trap 'rm -f "$temporary"' EXIT
  npx openapi-typescript "$SOURCE" -o "$temporary" >/dev/null
  npx prettier --write "$temporary" >/dev/null
  if ! cmp -s "$temporary" "$OUTPUT"; then
    echo "ERROR: generated internal scoring types are stale; run npm run contracts:generate" >&2
    diff -u "$OUTPUT" "$temporary" || true
    exit 1
  fi
  echo "Tipos internos de scoring: PASS"
else
  npx openapi-typescript "$SOURCE" -o "$OUTPUT"
  npx prettier --write "$OUTPUT" >/dev/null
fi
