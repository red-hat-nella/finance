#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="scoring-performance-$RANDOM"
PORT="${PERFORMANCE_DB_PORT:-55436}"
cleanup(){ podman rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
podman run -d --name "$NAME" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=alternative_scoring \
  -p "127.0.0.1:$PORT:5432" docker.io/library/postgres@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55 >/dev/null
ready=0
for _ in $(seq 1 60); do
  if podman exec "$NAME" psql -At -U postgres -d alternative_scoring -c 'select 1' 2>/dev/null | grep -qx 1; then
    ready=$((ready + 1))
    [[ "$ready" -ge 3 ]] && break
  else
    ready=0
  fi
  sleep .5
done
[[ "$ready" -ge 3 ]] || { podman logs "$NAME" >&2; exit 1; }
for migration in "$ROOT"/db/migrations/*.sql; do
  podman exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d alternative_scoring < "$migration" >/dev/null
done
TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:$PORT/alternative_scoring" \
  npm --prefix "$ROOT/services/ingestion" run test:performance
