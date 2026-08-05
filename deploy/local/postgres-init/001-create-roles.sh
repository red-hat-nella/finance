#!/usr/bin/env bash
set -euo pipefail

application_password="$(cat /run/secrets/postgres_password)"
retention_password="$(cat /run/secrets/postgres_retention_password)"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=application_password="$application_password" \
  --set=retention_password="$retention_password" \
  --file=/opt/scoring-init/001-create-roles.sql
