#!/usr/bin/env bash
set -euo pipefail

ENGINE="${1:-podman}"
shift || true
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_ARGS=(--env-file "${ROOT_DIR}/deploy/local/.env")

case "${ENGINE}" in
  docker)
    command -v docker >/dev/null || { printf 'Docker no esta instalado.\n' >&2; exit 127; }
    exec docker compose -f "${ROOT_DIR}/deploy/local/compose.yaml" -f "${ROOT_DIR}/deploy/local/compose.docker.yaml" "${ENV_ARGS[@]}" "$@"
    ;;
  podman)
    command -v podman >/dev/null || { printf 'Podman no esta instalado.\n' >&2; exit 127; }
    declare -A PODMAN_SECRETS=(
      [postgres_password]="postgres-password"
      [scoring_service_token]="scoring-service-token"
      [pii_encryption_key]="pii-encryption-key"
      [pii_hmac_key]="pii-hmac-key"
    )
    for name in "${!PODMAN_SECRETS[@]}"; do
      podman secret inspect "$name" >/dev/null 2>&1 || podman secret create "$name" "${ROOT_DIR}/deploy/local/.secrets/${PODMAN_SECRETS[$name]}" >/dev/null
    done
    exec podman compose -f "${ROOT_DIR}/deploy/local/compose.yaml" -f "${ROOT_DIR}/deploy/local/compose.podman.yaml" "${ENV_ARGS[@]}" "$@"
    ;;
  *)
    printf 'Motor no soportado: %s (use docker o podman).\n' "${ENGINE}" >&2
    exit 2
    ;;
esac
