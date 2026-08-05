#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"

cd "$ROOT"
bash scripts/test/us3-postgres.sh
BASE_URL="$BASE_URL" bash scripts/smoke/local-health.sh "${CONTAINER_ENGINE:-podman}"

cd "$ROOT/frontend"
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
  tests/e2e/us3-history-and-detail.spec.ts --project=desktop-1024
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
  tests/visual/us3-history-detail.visual.spec.ts \
  tests/accessibility/us3-history-detail.a11y.spec.ts

echo "US3 contract, PostgreSQL, E2E, visual and accessibility: PASS"
