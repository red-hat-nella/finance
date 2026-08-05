#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${IMAGE_REGISTRY:-localhost/alternative-credit-scoring}"
TAG="${IMAGE_TAG:-1.0.0}"
PUSH=false
[[ "${1:-}" == "--push" ]] && PUSH=true

podman build -t "$REGISTRY/frontend:$TAG" "$ROOT/frontend"
podman build -f "$ROOT/services/ingestion/Dockerfile" -t "$REGISTRY/ingestion:$TAG" "$ROOT"
podman build -t "$REGISTRY/scoring:$TAG" "$ROOT/services/scoring"

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

for component in frontend ingestion scoring; do
  image="$REGISTRY/$component:$TAG"
  verify_arbitrary_user "$component" "$image"
  id="$(podman image inspect "$image" --format '{{.Id}}')"
  printf '%s_IMAGE_ID=%s\n' "${component^^}" "$id"
  if [[ "$PUSH" == true ]]; then
    digest_file="$(mktemp)"
    podman push --digestfile "$digest_file" "$image" "docker://$image"
    printf '%s_DIGEST=%s\n' "${component^^}" "$(<"$digest_file")"
    rm "$digest_file"
  fi
done

echo "Imágenes reproducibles y UID arbitrario: PASS"
