#!/usr/bin/env bash
set -euo pipefail

application_password="$(cat /run/secrets/postgres_password)"
retention_password="$(cat /run/secrets/postgres_retention_password)"
terms_runtime_password="$(cat /run/secrets/terms_runtime_password)"
terms_migrator_password="$(cat /run/secrets/terms_migrator_password)"
terms_retention_password="$(cat /run/secrets/terms_retention_password)"
terms_backup_password="$(cat /run/secrets/terms_backup_password)"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=application_password="$application_password" \
  --set=retention_password="$retention_password" \
  --set=terms_runtime_password="$terms_runtime_password" \
  --set=terms_migrator_password="$terms_migrator_password" \
  --set=terms_retention_password="$terms_retention_password" \
  --set=terms_backup_password="$terms_backup_password" \
  --set=terms_database_name="${TERMS_DATABASE_NAME:-terms_local}" \
  --file=/opt/scoring-init/001-create-roles.sql
