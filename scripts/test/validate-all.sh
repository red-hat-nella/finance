#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$ROOT"
./scripts/test/spec-artifacts.sh
./scripts/contracts/validate.sh
./scripts/test/migrations.sh
npm --prefix services/ingestion run lint
npm --prefix services/ingestion run typecheck
npm --prefix services/ingestion run test
(cd services/scoring && uv run ruff check . && uv run pytest -q)
npm --prefix frontend run lint
npm --prefix frontend run build -- --configuration production
./scripts/test/manifests-policy.sh
