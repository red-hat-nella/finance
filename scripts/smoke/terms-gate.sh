#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENGINE="${1:-${CONTAINER_ENGINE:-podman}}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
PUBLIC_API="$BASE_URL/api/v1"
TERMS_API="$BASE_URL/terms-api/v1"
SECRET_DIR="$ROOT/deploy/local/.secrets"
work="$(mktemp -d)"

cleanup() { rm -rf "$work"; }
trap cleanup EXIT

for command in curl jq; do
  command -v "$command" >/dev/null || { echo "$command no está instalado." >&2; exit 127; }
done
for file in dev-analyst-token dev-terms-admin-token; do
  [[ -r "$SECRET_DIR/$file" ]] || {
    echo "Falta $SECRET_DIR/$file; ejecute scripts/dev/init-local-secrets.sh." >&2
    exit 2
  }
done

analyst_header="$work/analyst-header"
admin_header="$work/admin-header"
printf 'Authorization: Bearer %s' "$(<"$SECRET_DIR/dev-analyst-token")" > "$analyst_header"
printf 'Authorization: Bearer %s' "$(<"$SECRET_DIR/dev-terms-admin-token")" > "$admin_header"
chmod 600 "$analyst_header" "$admin_header"

wait_http() {
  local url="$1"
  for _ in $(seq 1 90); do
    curl -fsS "$url" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Timeout esperando $url" >&2
  return 1
}

wait_http "$BASE_URL/terms/health/live"
wait_http "$BASE_URL/terms-api/health/ready"

# Create and activate one unequivocally synthetic version through the public admin boundary.
draft="$work/draft.json"
jq -n '{
  versionCode:"SYNTHETIC-SMOKE-1",
  title:"Synthetic terms smoke document",
  contentFormat:"markdown",
  content:"# Synthetic terms\n\nThis is invented automated test content, not a legal document."
}' > "$draft"
created="$work/created.json"
curl -fsS -X POST "$TERMS_API/admin/versions" \
  -H "@$admin_header" -H 'content-type: application/json' \
  -H "X-Request-Id: $(cat /proc/sys/kernel/random/uuid)" \
  -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" \
  --data @"$draft" > "$created"
version_id="$(jq -er .versionId "$created")"
effective_at="$(date -u -d '1 minute ago' +%Y-%m-%dT%H:%M:%SZ)"
curl -fsS -X POST "$TERMS_API/admin/versions/$version_id/schedule" \
  -H "@$admin_header" -H 'content-type: application/json' \
  -H "X-Request-Id: $(cat /proc/sys/kernel/random/uuid)" \
  -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" \
  -d "{\"effectiveAt\":\"$effective_at\"}" >/dev/null

# Direct business access is blocked before any business result is returned.
blocked="$work/blocked.json"
status="$(curl -sS -o "$blocked" -w '%{http_code}' -X POST "$PUBLIC_API/evaluations/search" \
  -H "@$analyst_header" -H 'content-type: application/json' -d '{"page":1}')"
[[ "$status" == 428 ]]
jq -e '.code=="TERMS_ACCEPTANCE_REQUIRED" and .acceptanceUrl=="/terms/"' "$blocked" >/dev/null

current="$work/current.json"
curl -fsS "$TERMS_API/current" -H "@$analyst_header" \
  -H "X-Request-Id: $(cat /proc/sys/kernel/random/uuid)" > "$current"
acceptance="$work/acceptance.json"
jq '{versionId:.version.versionId,contentSha256:.version.contentSha256}' "$current" > "$acceptance"
curl -fsS -X POST "$TERMS_API/acceptances" \
  -H "@$analyst_header" -H 'content-type: application/json' \
  -H "X-Request-Id: $(cat /proc/sys/kernel/random/uuid)" \
  -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" \
  --data @"$acceptance" | jq -e --arg version "$version_id" '.versionId==$version' >/dev/null

# The same protected operation now reaches its normal contract (200; empty is valid).
curl -fsS -X POST "$PUBLIC_API/evaluations/search" \
  -H "@$analyst_header" -H 'content-type: application/json' -d '{"page":1}' \
  | jq -e '.items|type=="array"' >/dev/null

echo "Terms gate smoke ($ENGINE): blocked -> accepted -> authorized PASS"
