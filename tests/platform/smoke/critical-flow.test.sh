#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/platform/smoke"
[[ -x "$SCRIPT" ]] || { echo "platform smoke script missing" >&2; exit 1; }
for endpoint in applications evaluations search; do grep -q "$endpoint" "$SCRIPT"; done
grep -q '634' "$SCRIPT"
grep -q 'SCORING_UNAVAILABLE\|SCORING_TIMEOUT' "$SCRIPT"
grep -q 'Idempotency-Key' "$SCRIPT"
grep -q 'fixture' "$SCRIPT"
if grep -Eiq '(echo|printf).*(documentNumber|fullName|phone)' "$SCRIPT"; then
  echo "smoke logs or embeds PII fields" >&2
  exit 1
fi
echo "Critical flow smoke contract: PASS"
