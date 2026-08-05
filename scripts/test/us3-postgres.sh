#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="scoring-us3-$RANDOM"
cleanup() { podman rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

podman run -d --name "$NAME" \
  -e POSTGRES_PASSWORD=integration-password \
  -e POSTGRES_DB=alternative_scoring \
  -p 127.0.0.1::5432 \
  docker.io/library/postgres@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55 \
  >/dev/null

for _ in $(seq 1 60); do
  if podman exec "$NAME" pg_isready -U postgres -d alternative_scoring >/dev/null 2>&1; then
    break
  fi
  sleep .5
done
podman exec "$NAME" pg_isready -U postgres -d alternative_scoring >/dev/null

for migration in "$ROOT"/db/migrations/*.sql; do
  podman exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres \
    -d alternative_scoring < "$migration" >/dev/null
done

PORT="$(podman port "$NAME" 5432/tcp | awk -F: 'NR==1 {print $NF}')"
TEST_DATABASE_URL="postgresql://postgres:integration-password@127.0.0.1:${PORT}/alternative_scoring" \
  npm --prefix "$ROOT/services/ingestion" run test:integration -- \
  tests/integration/history/history-search.test.ts

echo "US3 PostgreSQL integration: PASS"
