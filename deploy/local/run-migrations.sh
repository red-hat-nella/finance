#!/usr/bin/env bash
set -euo pipefail
export PGPASSWORD="$(cat /run/secrets/postgres_password)"
psql -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS public.schema_migrations(filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())' >/dev/null
for migration in /migrations/*.sql; do
  filename="$(basename "$migration")"
  applied="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT 1 FROM public.schema_migrations WHERE filename='$filename'")"
  if [[ "$applied" != 1 ]]; then
    psql -v ON_ERROR_STOP=1 -f "$migration"
    psql -v ON_ERROR_STOP=1 -c "INSERT INTO public.schema_migrations(filename) VALUES('$filename')" >/dev/null
  fi
done
