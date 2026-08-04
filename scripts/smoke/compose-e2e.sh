#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; BASE="${BASE_URL:-http://127.0.0.1:8080}/api/v1"
fixture="$(mktemp)"; trap 'rm -f "$fixture"' EXIT
jq --arg document "74$(date +%s | tail -c 7)" '.applicant.documentNumber=$document' "$ROOT/tests/fixtures/medium-risk-application.json" > "$fixture"
application="$(curl -fsS -X POST "$BASE/applications" -H 'content-type: application/json' -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" --data @"$fixture")"
app_id="$(jq -r .applicationId <<<"$application")"
evaluation="$(curl -fsS -X POST "$BASE/applications/$app_id/evaluations" -H 'content-type: application/json' -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" -d '{"revisionNumber":1,"expectedCriteriaVersion":"SCORING-MVP-1.0.0"}')"
jq -e '.score==634 and .riskBand=="riesgo_medio" and .state=="revision_manual" and (.factors|length)==3' <<<"$evaluation" >/dev/null
evaluation_id="$(jq -r .evaluationId <<<"$evaluation")"; curl -fsS "$BASE/evaluations/$evaluation_id" | jq -e '.score==634' >/dev/null
curl -fsS -X POST "$BASE/evaluations/search" -H 'content-type: application/json' -d '{"page":1}' | jq -e --arg id "$evaluation_id" '.items|any(.evaluationId==$id)' >/dev/null
echo "Journey Compose: PASS ($evaluation_id)"
