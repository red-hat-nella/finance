#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CANARIES="$ROOT/tests/security/sensitive-canaries.txt"
LOGS="$(mktemp)"
trap 'rm -f "$LOGS"' EXIT

if command -v podman >/dev/null; then
  while IFS= read -r container; do
    podman logs "$container" >> "$LOGS" 2>&1 || true
  done < <(podman ps --format '{{.Names}}' | grep '^alternative-credit-scoring_' || true)
fi

while IFS= read -r canary; do
  [[ -z "$canary" ]] && continue
  if grep -Fq "$canary" "$LOGS"; then
    printf 'ERROR: canary sensible expuesto en logs runtime: %s\n' "$canary" >&2
    exit 1
  fi
done < "$CANARIES"

if grep -Eiq 'authorization[^[:alnum:]]+(bearer|basic)|document(Number|_number)|monthlyIncome|phone_ciphertext|email_ciphertext' "$LOGS"; then
  echo "ERROR: campo sensible expuesto en logs runtime." >&2
  exit 1
fi

npm --prefix "$ROOT/services/ingestion" run test -- --run \
  tests/unit/security/crypto_and_redaction.test.ts
echo "Logs runtime y redacción con canaries sensibles: PASS"
