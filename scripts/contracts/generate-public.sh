#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT/specs/001-alternative-credit-scoring/contracts/ingestion-public-v1.openapi.yaml"
FRONTEND="$ROOT/frontend/src/app/core/api/generated/index.ts"
INGESTION="$ROOT/services/ingestion/src/generated/public/index.ts"
mkdir -p "$(dirname "$FRONTEND")" "$(dirname "$INGESTION")"

format_generated() {
  local target="$1"
  if [[ -x "$ROOT/node_modules/.bin/prettier" ]]; then
    "$ROOT/node_modules/.bin/prettier" --write "$target" >/dev/null
  fi
}

if [[ "${1:-}" == "--check" ]]; then
  temporary="$(mktemp "$(dirname "$FRONTEND")/.generated.XXXXXX.ts")"
  trap 'rm -f "$temporary"' EXIT
  npx openapi-typescript "$SOURCE" -o "$temporary" >/dev/null
  format_generated "$temporary"
  for output in "$FRONTEND" "$INGESTION"; do
    if ! cmp -s "$temporary" "$output"; then
      echo "ERROR: generated public API types are stale; run npm run contracts:generate" >&2
      diff -u "$output" "$temporary" || true
      exit 1
    fi
  done
  echo "Tipos públicos de API: PASS"
else
  npx openapi-typescript "$SOURCE" -o "$FRONTEND"
  format_generated "$FRONTEND"
  cp "$FRONTEND" "$INGESTION"
fi
