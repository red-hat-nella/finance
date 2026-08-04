#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
for path in /health/live /api/v1/evaluations/search; do
  if [[ "$path" == */search ]]; then curl -fsS -X POST "$BASE_URL$path" -H 'content-type: application/json' -d '{"page":1}' >/dev/null; else curl -fsS "$BASE_URL$path" >/dev/null; fi
done
echo 'Health local: PASS'
