#!/usr/bin/env bash
set -euo pipefail
NAMESPACE="${1:?Uso: $0 <namespace>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRETS="$ROOT/deploy/local/.secrets"
oc -n "$NAMESPACE" create secret generic scoring-secrets \
  --from-file=database-admin-password="$SECRETS/postgres-admin-password" \
  --from-file=database-password="$SECRETS/postgres-password" \
  --from-file=database-retention-password="$SECRETS/postgres-retention-password" \
  --from-file=pii-encryption-key="$SECRETS/pii-encryption-key" \
  --from-file=pii-hmac-key="$SECRETS/pii-hmac-key" \
  --from-file=scoring-service-token="$SECRETS/scoring-service-token" \
  --dry-run=client -o yaml | oc apply -f - >/dev/null
echo "Secret scoring-secrets aplicado en $NAMESPACE."
