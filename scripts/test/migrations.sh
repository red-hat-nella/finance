#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="scoring-migrations-$RANDOM"
cleanup(){ podman rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
podman run -d --name "$NAME" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=alternative_scoring -p 55432:5432 docker.io/library/postgres@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55 >/dev/null
sleep 2
ready=0
for _ in $(seq 1 60); do
  if podman exec "$NAME" psql -At -U postgres -d alternative_scoring -c "select 1" 2>/dev/null | grep -qx 1; then
    ready=$((ready + 1))
    [[ "$ready" -ge 3 ]] && break
  else
    ready=0
  fi
  sleep .5
done
if [[ "$ready" -lt 3 ]]; then
  echo 'ERROR: PostgreSQL did not become stable' >&2
  podman logs "$NAME" >&2
  exit 1
fi
for migration in "$ROOT"/db/migrations/*.sql; do
  podman exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d alternative_scoring < "$migration" >/dev/null
done
tables=$(podman exec "$NAME" psql -At -U postgres -d alternative_scoring -c "select count(*) from information_schema.tables where table_schema='scoring'")
[[ "$tables" -ge 15 ]]
constraints=$(podman exec "$NAME" psql -At -U postgres -d alternative_scoring -c "select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='scoring'")
[[ "$constraints" -ge 25 ]]
indexes=$(podman exec "$NAME" psql -At -U postgres -d alternative_scoring -c "select count(*) from pg_indexes where schemaname='scoring' and indexname in ('uq_applicant_document_active','ix_evaluation_owner_history','ix_audit_evaluation_time')")
[[ "$indexes" -eq 3 ]]
roles=$(podman exec "$NAME" psql -At -U postgres -d alternative_scoring -c "select count(*) from pg_roles where rolname in ('scoring_app','scoring_migrator')")
[[ "$roles" -eq 2 ]]
audit_update=$(podman exec "$NAME" psql -At -U postgres -d alternative_scoring -c "select has_table_privilege('scoring_app','scoring.audit_events','UPDATE')")
[[ "$audit_update" == f ]]
podman exec "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d alternative_scoring -c "insert into scoring.audit_events(correlation_id,event_type,outcome) values(gen_random_uuid(),'TEST','ok')" >/dev/null
if podman exec "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d alternative_scoring -c "delete from scoring.audit_events" >/dev/null 2>&1; then
  echo 'ERROR: audit table is mutable' >&2; exit 1
fi
echo "Migraciones PostgreSQL: PASS ($tables tablas, $constraints constraints, roles acotados)"
