#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node tests/platform/profiles/contracts.test.mjs
tests/platform/profiles/discovery-allowlist.test.sh
tests/platform/render/kustomize.test.sh
tests/platform/policy/workload-security.test.sh
tests/platform/migrations/release-job.test.sh
tests/platform/images/immutable-promotion.test.sh
tests/platform/pipeline/pipeline-contract.test.sh
tests/platform/pipeline/offline-release.test.sh
tests/platform/pipeline/failure-gates.test.sh
tests/platform/gitops/migration-order.test.sh
tests/platform/smoke/critical-flow.test.sh
tests/platform/operations/workload-lifecycle.test.sh
tests/platform/network/connectivity.test.sh
tests/platform/operations/dependency-failure.test.sh
tests/platform/recovery/persistence.test.sh
tests/platform/recovery/backup-restore.test.sh
tests/platform/recovery/rollback.test.sh
tests/platform/observability/telemetry.test.sh
scripts/platform/render --all --output-dir build/rendered
scripts/platform/validate --all --cluster-version 4.21.21 --evidence-dir build/platform/evidence/static
scripts/platform/generate-operations-doc --render-root build/rendered --cluster-profile build/platform/dev-profile.json --output docs/operations/openshift-deployment.md
scripts/platform/validate-operations-doc docs/operations/openshift-deployment.md
node tests/platform/documentation/generator.test.mjs
node tests/platform/documentation/provenance.test.mjs
tests/platform/documentation/sensitive-data.test.sh
tests/platform/documentation/offline-generation.test.sh
node tests/platform/documentation/cluster-enrichment.test.mjs
tests/platform/operations/quickstart.test.sh
echo "OpenShift platform feature validation: PASS"
