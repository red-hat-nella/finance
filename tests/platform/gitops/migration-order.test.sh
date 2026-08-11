#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
JOB="$ROOT/deploy/openshift/base/jobs/migrations-job.yaml"
grep -q 'argocd.argoproj.io/hook: PreSync' "$JOB"
grep -q 'argocd.argoproj.io/sync-wave: "-1"' "$JOB"
for component in frontend ingestion scoring; do
  grep -q 'argocd.argoproj.io/sync-wave: "0"' "$ROOT/deploy/openshift/base/$component/deployment.yaml"
done
grep -qi 'schema.*compatib' "$ROOT/scripts/platform/rollback"
grep -qi 'destructive' "$ROOT/scripts/platform/rollback"
echo "Migration ordering and rollback guard: PASS"
