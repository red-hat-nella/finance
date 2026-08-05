#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENGINE="${1:-${CONTAINER_ENGINE:-podman}}"
BASE="${BASE_URL:-http://127.0.0.1:8080}/api/v1"
KEEP_STACK="${KEEP_SMOKE_STACK:-false}"
fixture="$(mktemp)"

compose() { "$ROOT/scripts/dev/compose.sh" "$ENGINE" "$@"; }
cleanup_files() {
  rm -f "$fixture"
  if [[ "$KEEP_STACK" != true ]]; then
    compose down --volumes --remove-orphans >/dev/null 2>&1 || true
    "$ROOT/scripts/dev/clean-local-secrets.sh"
  fi
}
trap cleanup_files EXIT

command -v "$ENGINE" >/dev/null || { echo "$ENGINE no está instalado." >&2; exit 127; }
"$ROOT/scripts/dev/init-local-secrets.sh" >/dev/null
compose down --volumes --remove-orphans >/dev/null 2>&1 || true
if [[ "$ENGINE" == podman ]]; then
  for secret in postgres_admin_password postgres_password postgres_retention_password \
    scoring_service_token pii_encryption_key pii_hmac_key; do
    podman secret rm "$secret" >/dev/null 2>&1 || true
  done
fi
compose up --build -d
"$ROOT/scripts/smoke/local-health.sh" "$ENGINE"

create_application() {
  local suffix="$1" created
  jq --arg document "74${suffix}" '.applicant.documentNumber=$document' \
    "$ROOT/tests/fixtures/medium-risk-application.json" > "$fixture"
  created="$(curl -fsS -i -X POST "$BASE/applications" \
    -H 'content-type: application/json' \
    -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" --data @"$fixture")"
  ETAG="$(printf '%s\n' "$created" | awk 'BEGIN{IGNORECASE=1} /^etag:/ {gsub("\r",""); print $2}')"
  APP_ID="$(printf '%s\n' "$created" | sed '1,/^\r$/d' | jq -r .applicationId)"
}

create_application "$(date +%s%N | tail -c 8)"
evaluation="$(curl -fsS -X POST "$BASE/applications/$APP_ID/evaluations" \
  -H 'content-type: application/json' \
  -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" -H "If-Match: $ETAG" \
  -d '{"revisionNumber":1,"expectedCriteriaVersion":"SCORING-MVP-1.0.0"}')"
jq -e '.score==634 and .riskBand=="riesgo_medio" and .state=="revision_manual" and (.factors|length)==3' <<<"$evaluation" >/dev/null
evaluation_id="$(jq -r .evaluationId <<<"$evaluation")"
curl -fsS "$BASE/evaluations/$evaluation_id" | jq -e '.score==634' >/dev/null
curl -fsS -X POST "$BASE/evaluations/search" -H 'content-type: application/json' \
  -d '{"page":1}' | jq -e --arg id "$evaluation_id" '.items|any(.evaluationId==$id)' >/dev/null

compose stop scoring >/dev/null
create_application "$(date +%s%N | tail -c 8)"
error_file="$(mktemp)"
status="$(curl -sS -o "$error_file" -w '%{http_code}' -X POST "$BASE/applications/$APP_ID/evaluations" \
  -H 'content-type: application/json' \
  -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" -H "If-Match: $ETAG" \
  -d '{"revisionNumber":1,"expectedCriteriaVersion":"SCORING-MVP-1.0.0"}')"
[[ "$status" == 502 || "$status" == 504 ]]
jq -e '.retryable==true and (.evaluationId|type=="string") and (.code=="SCORING_UNAVAILABLE" or .code=="SCORING_TIMEOUT")' "$error_file" >/dev/null
failed_id="$(jq -r .evaluationId "$error_file")"
rm -f "$error_file"

compose start scoring >/dev/null
scoring_ready=false
for _ in $(seq 1 60); do
  compose exec -T scoring python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready')" \
    >/dev/null 2>&1 && { scoring_ready=true; break; }
  sleep 1
done
[[ "$scoring_ready" == true ]]
create_application "$(date +%s%N | tail -c 8)"
recovered="$(curl -fsS -X POST "$BASE/applications/$APP_ID/evaluations" \
  -H 'content-type: application/json' \
  -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" -H "If-Match: $ETAG" \
  -d '{"revisionNumber":1,"expectedCriteriaVersion":"SCORING-MVP-1.0.0"}')"
jq -e '.score==634 and .state=="revision_manual"' <<<"$recovered" >/dev/null

echo "Smoke limpio $ENGINE: PASS (journey=$evaluation_id, failure=$failed_id, recovered=$(jq -r .evaluationId <<<"$recovered"))"
