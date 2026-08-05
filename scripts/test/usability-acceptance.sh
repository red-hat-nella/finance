#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"

"$ROOT/scripts/smoke/local-health.sh" "${CONTAINER_ENGINE:-podman}"
cd "$ROOT/frontend"
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test \
  tests/acceptance/mvp-usability-heuristics.spec.ts --project=desktop-1024

echo "Aceptación automatizada y heurística SC-001/SC-005/SC-006: PASS"
