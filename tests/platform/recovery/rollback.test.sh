#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/platform/rollback"
grep -q 'gitops-revert' "$SCRIPT"
grep -q 'N-1 compatible' "$SCRIPT"
grep -qi 'destructive down migration is forbidden' "$SCRIPT"
if grep -Eq 'oc[[:space:]]+(apply|delete|set image|rollout undo)' "$SCRIPT"; then echo "rollback writes directly to cluster" >&2; exit 1; fi
echo "Declarative rollback guard: PASS"
