#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/platform/verify-persistence"
[[ -x "$SCRIPT" ]] || { echo "persistence verifier missing" >&2; exit 1; }
grep -q 'delete pod.*app.kubernetes.io/name=ingestion' "$SCRIPT"
grep -q 'delete pod.*app.kubernetes.io/name=frontend' "$SCRIPT"
if grep -Eq 'delete .*pvc|delete .*statefulset|delete pod.*app.kubernetes.io/name=postgres' "$SCRIPT"; then echo "persistence verifier risks durable data" >&2; exit 1; fi
grep -q 'Idempotency-Key' "$ROOT/scripts/platform/smoke"
grep -q 'evaluation' "$SCRIPT"
echo "Persistence recreation contract: PASS"
