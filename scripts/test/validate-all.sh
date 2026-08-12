#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENGINE="${CONTAINER_ENGINE:-podman}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"
export CONTAINER_ENGINE="$ENGINE" PLAYWRIGHT_BASE_URL="$BASE_URL"

cleanup() {
  if [[ -f "$ROOT/deploy/local/.env.secrets" ]]; then
    "$ROOT/scripts/dev/compose.sh" "$ENGINE" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  "$ROOT/scripts/dev/clean-local-secrets.sh"
}
trap cleanup EXIT
cleanup

cd "$ROOT"
bash scripts/test/spec-artifacts.sh
bash scripts/security/verify-no-secrets.sh
bash scripts/test/migrations.sh
bash scripts/test/validate-us1.sh
bash scripts/test/validate-us2.sh
bash scripts/test/validate-us3.sh
bash scripts/test/validate-us4.sh
bash scripts/test/retention-postgres.sh
bash scripts/test/performance-postgres.sh
bash scripts/test/validate-terms-us1.sh
bash scripts/test/validate-terms-us2.sh
bash scripts/test/validate-terms-us3.sh
node --test tests/security/terms-data-minimization.test.mjs
node --test tests/platform/terms-*.test.mjs
bash scripts/platform/verify-backup-restore --scope terms --evidence build/validation/terms/restore-evidence.json
bash scripts/platform/verify-terms-release --environment dev --evidence build/validation/terms/release-evidence.json
bash scripts/test/validate-scoring-regression.sh

cd "$ROOT/frontend"
npx playwright test tests/e2e/full-mvp-journey.spec.ts --project=desktop-1024
npx playwright test tests/visual/full-mvp.visual.spec.ts
npx playwright test tests/accessibility/full-mvp.a11y.spec.ts
cd "$ROOT"
bash scripts/test/usability-acceptance.sh

cd "$ROOT/apps/terms-web"
npm run lint
npm run test -- --watch=false --browsers=ChromeHeadless
npx playwright test tests/e2e tests/visual tests/accessibility tests/performance --workers=1
cd "$ROOT"
bash scripts/test/validate-terms-quickstart.sh

bash scripts/security/scan-runtime-logs.sh
bash scripts/test/manifests-policy.sh
bash scripts/test/validate-platform.sh
bash scripts/images/build.sh
bash scripts/images/scan.sh
git diff --check
echo "Gate integral reproducible: PASS"
