#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENGINE="${1:-${CONTAINER_ENGINE:-podman}}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"

wait_http() {
  local url="$1"
  for _ in $(seq 1 90); do
    curl -fsS "$url" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Timeout esperando $url" >&2
  return 1
}

wait_http "$BASE_URL/health/live"
wait_http "$BASE_URL/health/ready"
"$ROOT/scripts/dev/compose.sh" "$ENGINE" exec -T ingestion \
  node -e "fetch('http://127.0.0.1:8080/health/ready').then(r=>{if(!r.ok)process.exit(1)})"
"$ROOT/scripts/dev/compose.sh" "$ENGINE" exec -T scoring \
  python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready')"
curl -fsS -X POST "$BASE_URL/api/v1/evaluations/search" \
  -H 'content-type: application/json' -d '{"page":1}' >/dev/null
echo "Health local ($ENGINE): PASS"
