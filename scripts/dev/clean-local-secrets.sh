#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
rm -f "$ROOT/deploy/local/.env.secrets" \
  "$ROOT/deploy/local/.secrets/postgres-admin-password" \
  "$ROOT/deploy/local/.secrets/postgres-password" \
  "$ROOT/deploy/local/.secrets/postgres-retention-password" \
  "$ROOT/deploy/local/.secrets/pii-encryption-key" \
  "$ROOT/deploy/local/.secrets/pii-hmac-key" \
  "$ROOT/deploy/local/.secrets/scoring-service-token" \
  "$ROOT/deploy/local/.secrets/dev-auth-private.pem" \
  "$ROOT/deploy/local/.secrets/dev-auth-public.pem" \
  "$ROOT/deploy/local/.secrets/jwks.json" \
  "$ROOT/deploy/local/.secrets/dev-analyst-token" \
  "$ROOT/deploy/local/.secrets/dev-supervisor-token"
