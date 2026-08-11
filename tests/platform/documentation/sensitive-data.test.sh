#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DOC="$(mktemp)"; trap 'rm -f "$DOC"' EXIT
"$ROOT/scripts/platform/generate-operations-doc" --offline --render-root "$ROOT/build/rendered" --output "$DOC"
if grep -Eqi -- 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|https?://[^ /:]+:[^ /@]+@|kind:[[:space:]]*Secret' "$DOC"; then echo "sensitive content in generated document" >&2; exit 1; fi
printf '\npassword=not-allowed\n' >> "$DOC"
if (cd "$ROOT" && "$ROOT/scripts/platform/validate-operations-doc" "$DOC") >/dev/null 2>&1; then echo "validator accepted credential-like content" >&2; exit 1; fi
echo "Documentation sensitive-data guard: PASS"
