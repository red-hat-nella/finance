#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
for file in backup.yaml restore-test.yaml; do [[ -s "$ROOT/deploy/openshift/components/postgres-dev/$file" ]]; done
SCRIPT="$ROOT/scripts/platform/verify-backup-restore"; [[ -x "$SCRIPT" ]]
for term in pg_dump pg_restore encryption isolated schema integrity smoke pii-keyring retention; do grep -qi "$term" "$SCRIPT" || { echo "restore verifier missing $term" >&2; exit 1; }; done
if grep -Eq 'cat .*pii|echo .*pass|set -x' "$SCRIPT"; then echo "recovery script may expose sensitive material" >&2; exit 1; fi
echo "Backup and isolated restore contract: PASS"
