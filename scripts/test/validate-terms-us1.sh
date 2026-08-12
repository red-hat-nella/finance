#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

scripts/contracts/validate.sh
scripts/contracts/generate-public.sh --check
scripts/contracts/generate-terms-internal.sh --check

npm --prefix services/ingestion run lint
npm --prefix services/ingestion run typecheck
npm --prefix services/ingestion run test -- --run tests/terms/terms-access-client.test.ts
npm --prefix services/ingestion run test:integration -- --run tests/terms/terms-gate.integration.test.ts

npm --prefix frontend run lint
npx tsc --noEmit -p frontend/tsconfig.app.json
npx tsc --noEmit -p frontend/tsconfig.spec.json

if [[ "${TERMS_US1_RUN_SMOKE:-false}" == "true" ]]; then
  scripts/smoke/terms-gate.sh "${CONTAINER_ENGINE:-podman}"
fi

echo "Terms US1 contract, client, fail-closed gate and frontend mapping: PASS"
