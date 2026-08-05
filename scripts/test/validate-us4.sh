#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"
CHROME_BIN="${CHROME_BIN:-${HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome}"
export CHROME_BIN

cd "$ROOT"
npm run contracts:lint
bash scripts/contracts/generate-public.sh --check
npm --prefix services/ingestion run lint
npm --prefix services/ingestion run typecheck
npm --prefix services/ingestion run test
bash scripts/test/us4-postgres.sh
npm --prefix frontend run lint
npm --prefix frontend run test -- --watch=false --browsers=ChromeHeadless
BASE_URL="$BASE_URL" bash scripts/smoke/local-health.sh "${CONTAINER_ENGINE:-podman}"

cd "$ROOT/frontend"
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
  tests/e2e/us4-supervisor-audit.spec.ts --project=desktop-1024
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
  tests/visual/us4-audit.visual.spec.ts \
  tests/accessibility/us4-audit.a11y.spec.ts

echo "US4 audit integrity, authorization, read-only UI, visual and accessibility: PASS"
