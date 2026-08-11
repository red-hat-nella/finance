#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# The OpenShift CLI provides the same `kustomize` subcommand used by the
# platform checks. Expose a workspace-local kubectl shim when the toolbox only
# contains `oc`, without requiring another mutable tool image.
if ! command -v kubectl >/dev/null 2>&1 && command -v oc >/dev/null 2>&1; then
  PIPELINE_BIN="$ROOT/.pipeline-bin"
  mkdir -p "$PIPELINE_BIN"
  ln -sf "$(command -v oc)" "$PIPELINE_BIN/kubectl"
  export PATH="$PIPELINE_BIN:$PATH"
fi

npm ci --ignore-scripts
npm --prefix frontend ci --ignore-scripts
npm --prefix services/ingestion ci --ignore-scripts
bash scripts/test/spec-artifacts.sh
bash scripts/security/verify-no-secrets.sh
npm run contracts:lint
npm run contracts:test
npm --prefix services/ingestion run lint
npm --prefix services/ingestion run typecheck
npm --prefix services/ingestion run test
npm --prefix frontend run lint
(cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json)
(cd services/scoring && UV_CACHE_DIR=/tmp/finance2-uv-cache uv sync --frozen --group dev && UV_CACHE_DIR=/tmp/finance2-uv-cache uv run ruff check . && UV_CACHE_DIR=/tmp/finance2-uv-cache uv run mypy app && UV_CACHE_DIR=/tmp/finance2-uv-cache uv run pytest -q)
bash scripts/test/validate-platform.sh
echo "Pipeline-compatible repository validation: PASS"
