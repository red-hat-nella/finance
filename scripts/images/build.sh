#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${IMAGE_REGISTRY:-localhost/alternative-credit-scoring}"
TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse HEAD)}"
OUT="${IMAGE_BUILD_OUTPUT:-$ROOT/build/images/build.json}"
if [[ "${1:-}" == "--push" ]]; then
  echo "--push was removed; use scripts/images/publish.sh after scan" >&2
  exit 2
fi
[[ "$TAG" =~ ^[0-9a-f]{40}$ ]] || { echo "IMAGE_TAG must be the full commit SHA" >&2; exit 2; }

podman build -t "$REGISTRY/frontend:$TAG" "$ROOT/frontend"
podman build -f "$ROOT/services/ingestion/Dockerfile" -t "$REGISTRY/ingestion:$TAG" "$ROOT"
podman build -t "$REGISTRY/scoring:$TAG" "$ROOT/services/scoring"
podman build -f "$ROOT/apps/terms-web/Dockerfile" -t "$REGISTRY/terms-web:$TAG" "$ROOT"
podman build -f "$ROOT/services/terms-api/Dockerfile" -t "$REGISTRY/terms-api:$TAG" "$ROOT"

verify_arbitrary_user() {
  local component="$1" image="$2" name="image-check-${component}-$RANDOM" port ready=false
  local -a args=(-d --name "$name" --user 12345:0 --read-only --tmpfs /tmp:rw,nosuid,nodev -p 127.0.0.1::8080)
  case "$component" in
    frontend)
      args+=(--add-host ingestion:127.0.0.1 --tmpfs /var/cache/nginx:rw,nosuid,nodev --tmpfs /opt/app-root/runtime-config:rw,nosuid,nodev -e API_BASE_URL=/api/v1 -e AUTH_MODE=development -e OIDC_ISSUER= -e OIDC_CLIENT_ID=scoring-ui -e OIDC_SCOPE="openid profile")
      ;;
    scoring)
      args+=(-e APP_ENV=development -e SCORING_SERVICE_TOKEN=development-scoring-token-32-bytes-minimum)
      ;;
    ingestion)
      args+=(-e NODE_ENV=development -e DATABASE_HOST=127.0.0.1)
      ;;
    terms-web)
      args+=(--add-host terms-api:127.0.0.1 --tmpfs /var/cache/nginx:rw,nosuid,nodev --tmpfs /opt/app-root/runtime-config:rw,nosuid,nodev -e TERMS_API_BASE_URL=/terms-api -e AUTH_MODE=oidc -e OIDC_ISSUER=https://identity.invalid -e OIDC_CLIENT_ID=terms-web -e OIDC_SCOPE="openid profile")
      ;;
    terms-api)
      args+=(-e NODE_ENV=development -e DATABASE_HOST=127.0.0.1)
      ;;
  esac
  podman run "${args[@]}" "$image" >/dev/null
  port="$(podman port "$name" 8080/tcp | awk -F: 'NR==1 {print $NF}')"
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${port}/health/live" >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep .5
  done
  if [[ "$ready" != true ]]; then podman logs "$name" >&2; fi
  podman rm -f "$name" >/dev/null
  [[ "$ready" == true ]]
}

records="$(mktemp)"
trap 'rm -f "$records"' EXIT
for component in frontend ingestion scoring terms-web terms-api; do
  image="$REGISTRY/$component:$TAG"
  verify_arbitrary_user "$component" "$image"
  id="$(podman image inspect "$image" --format '{{.Id}}')"
  printf '%s_IMAGE_ID=%s\n' "${component^^}" "$id"
  jq -n --arg component "$component" --arg image "$image" --arg imageId "$id" \
    '{component:$component,image:$image,imageId:$imageId}' >> "$records"
done

mkdir -p "$(dirname "$OUT")"
jq -s --arg commitSha "$TAG" \
  '{schemaVersion:"image-build.finance2/v1",commitSha:$commitSha,images:map({key:.component,value:{reference:.image,imageId:.imageId}})|from_entries}' \
  "$records" > "$OUT"

echo "Imágenes construidas una vez y UID arbitrario: PASS ($OUT)"
