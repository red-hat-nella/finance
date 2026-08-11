#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PIPELINE="$ROOT/.tekton/pipeline.yaml"

for task in inspect test secure build-image render publish propose-gitops verify; do
  file="$ROOT/.tekton/tasks/$task.yaml"
  [[ -s "$file" ]] || { echo "missing gate task: $task" >&2; exit 1; }
  if grep -Eq 'onError:[[:space:]]*continue|exit[[:space:]]+0[[:space:]]*#.*fail' "$file"; then
    echo "$task bypasses failures" >&2
    exit 1
  fi
done
grep -q 'runAfter: \[publish\]' "$PIPELINE"
grep -q 'runAfter: \[promote\]' "$PIPELINE"
for script in render validate smoke; do
  grep -q 'set -euo pipefail' "$ROOT/scripts/platform/$script"
done
echo "Mandatory failure gates: PASS"
