#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIGRATOR="$ROOT/services/ingestion/src/jobs/migrate.ts"
JOB="$ROOT/deploy/openshift/base/jobs/migrations-job.yaml"

grep -q 'pg_advisory_lock' "$MIGRATOR"
grep -q 'checksum' "$MIGRATOR"
grep -q 'ON CONFLICT' "$MIGRATOR"
grep -q 'activeDeadlineSeconds' "$JOB"
grep -q 'ttlSecondsAfterFinished' "$JOB"
grep -q 'database-migrator' "$JOB"
if grep -Eq 'DATABASE_USER.*postgres|database-admin-password|ALTER ROLE|CREATE ROLE' "$JOB"; then
  echo "release migration must not use database superuser or provision roles" >&2
  exit 1
fi
grep -qi 'expand/contract' "$ROOT/db/migrations/README.md"
echo "Release migration concurrency and compatibility contract: PASS"
