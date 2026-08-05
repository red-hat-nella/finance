#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${US1_BASE_URL:-http://127.0.0.1:8080}"
CHROME_BIN="${CHROME_BIN:-${HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome}"
export CHROME_BIN

cd "$ROOT"
npm run contracts:lint
npm run contracts:test
bash scripts/contracts/generate-public.sh --check
bash scripts/contracts/generate-scoring.sh --check

npm --prefix services/ingestion run lint
npm --prefix services/ingestion run typecheck
npm --prefix services/ingestion run test
bash scripts/test/us1-postgres.sh

(cd services/scoring && uv run ruff check .)
(cd services/scoring && uv run mypy app)
(cd services/scoring && uv run pytest -q)

npm --prefix frontend run lint
(cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json)
npm --prefix frontend run test -- --watch=false --browsers=ChromeHeadless

KEEP_SMOKE_STACK=true BASE_URL="$BASE_URL" bash scripts/smoke/compose-e2e.sh "${CONTAINER_ENGINE:-podman}"
(
  cd frontend
  PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
    tests/e2e/us1-main-journey.spec.ts --project=desktop-1024
  PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
    tests/visual/us1-form-result.visual.spec.ts
  PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
    tests/accessibility/us1-form-result.a11y.spec.ts
)

echo "US1 contracts, services, E2E, visual and accessibility: PASS"
