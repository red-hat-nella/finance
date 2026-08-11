#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
for file in services/ingestion/src/observability/metrics.ts services/scoring/app/observability/metrics.py deploy/observability/alerts.yaml; do [[ -s "$ROOT/$file" ]] || { echo "missing telemetry artifact: $file" >&2; exit 1; }; done
for signal in frontend ingestion scoring migrations retention reconciler postgresql gitops; do grep -qi "$signal" "$ROOT/deploy/observability/alerts.yaml" || { echo "missing alert contract: $signal" >&2; exit 1; }; done
grep -q '/metrics' "$ROOT/services/ingestion/src/app.ts"
grep -q '/metrics' "$ROOT/services/scoring/app/main.py"
bash "$ROOT/scripts/security/scan-runtime-logs.sh"
npm --prefix "$ROOT/services/ingestion" run test -- --run tests/unit/config/pii-keyring.test.ts
(cd "$ROOT/services/scoring" && UV_CACHE_DIR=/tmp/finance2-uv-cache uv run pytest -q tests/unit/test_metrics.py)
echo "Telemetry and safe logging: PASS"
