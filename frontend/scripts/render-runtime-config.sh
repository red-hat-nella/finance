#!/usr/bin/env bash
set -euo pipefail

template="${RUNTIME_CONFIG_TEMPLATE:-/opt/app-root/src/runtime-config.template.json}"
output="${RUNTIME_CONFIG_OUTPUT:-/opt/app-root/runtime-config/runtime-config.json}"

envsubst '${API_BASE_URL} ${AUTH_MODE} ${OIDC_ISSUER} ${OIDC_CLIENT_ID} ${OIDC_SCOPE}' \
  < "$template" > "$output"
