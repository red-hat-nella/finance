#!/usr/bin/env bash
set -euo pipefail

ROLE="${1:-credit_analyst}"
DEV_AUTH_PRIVATE_KEY_FILE="${DEV_AUTH_PRIVATE_KEY_FILE:-deploy/local/.secrets/dev-auth-private.pem}" \
  node scripts/dev/issue-token.mjs "${ROLE}"
