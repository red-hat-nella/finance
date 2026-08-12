#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT/specs/003-accept-terms/contracts/terms-public-v1.openapi.yaml"
OUTPUT="$ROOT/apps/terms-web/src/app/core/api/generated/terms-public.ts"
mkdir -p "$(dirname "$OUTPUT")"

format_generated() {
  local target="$1"
  if [[ -x "$ROOT/node_modules/.bin/prettier" ]]; then
    "$ROOT/node_modules/.bin/prettier" --write "$target" >/dev/null
  fi
}

if [[ "${1:-}" == "--check" ]]; then
  temporary="$(mktemp "$(dirname "$OUTPUT")/.generated.XXXXXX.ts")"
  trap 'rm -f "$temporary"' EXIT
  npx openapi-typescript "$SOURCE" -o "$temporary" >/dev/null
  format_generated "$temporary"
  if ! cmp -s "$temporary" "$OUTPUT"; then
    echo "ERROR: generated terms public API types are stale; run scripts/contracts/generate-terms-public.sh" >&2
    diff -u "$OUTPUT" "$temporary" || true
    exit 1
  fi
  echo "Tipos públicos de terms: PASS"
else
  npx openapi-typescript "$SOURCE" -o "$OUTPUT"
  format_generated "$OUTPUT"
fi
