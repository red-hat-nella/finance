#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
grep -q 'SELECT 1' "$ROOT/services/ingestion/src/http/routes/health.routes.ts"
grep -q 'database: "unavailable"' "$ROOT/services/ingestion/src/http/routes/health.routes.ts"
grep -q 'criteria_version' "$ROOT/services/scoring/app/api/health.py"
npm --prefix "$ROOT/services/ingestion" run test:integration -- tests/integration/evaluations/scoring-failures.test.ts
npm --prefix "$ROOT/services/ingestion" run test:authorization -- tests/authorization/auth_middleware.test.ts
echo "Dependency degradation behavior: PASS"
