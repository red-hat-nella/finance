#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${US2_BASE_URL:-http://127.0.0.1:8080}"

cd "$ROOT"
npm run contracts:lint
bash scripts/contracts/generate-public.sh --check
npm --prefix services/ingestion run test -- --run \
  tests/unit/scoring/scoring-client.test.ts \
  tests/unit/scoring/circuit-breaker.test.ts \
  tests/unit/evaluations/evaluation-failure.service.test.ts
bash scripts/test/us2-postgres.sh
(cd services/scoring && uv run pytest -q \
  tests/unit/test_manual_review.py \
  tests/contract/test_invalid_and_manual_requests.py)

if ! curl -fsS "$BASE_URL/health/live" >/dev/null; then
  echo "ERROR: el frontend no está disponible en $BASE_URL" >&2
  exit 1
fi

cd "$ROOT/frontend"
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
  tests/e2e/us2-errors-and-recovery.spec.ts
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
  tests/visual/us2-error-states.visual.spec.ts \
  tests/accessibility/us2-error-states.a11y.spec.ts

echo "US2 failures, manual review, recovery, visual and accessibility: PASS"
