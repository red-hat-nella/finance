#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRET_DIR="${ROOT_DIR}/deploy/local/.secrets"
ENV_FILE="${ROOT_DIR}/deploy/local/.env.secrets"
mkdir -p "${SECRET_DIR}"
chmod 700 "${SECRET_DIR}"
umask 077
find "${SECRET_DIR}" -maxdepth 1 -type f -exec chmod 0600 {} +

openssl rand -base64 32 > "${SECRET_DIR}/postgres-admin-password"
openssl rand -base64 32 > "${SECRET_DIR}/postgres-password"
openssl rand -base64 32 > "${SECRET_DIR}/postgres-retention-password"
openssl rand 32 > "${SECRET_DIR}/pii-encryption-key"
openssl rand 32 > "${SECRET_DIR}/pii-hmac-key"
openssl rand -base64 48 > "${SECRET_DIR}/scoring-service-token"
openssl rand -base64 32 > "${SECRET_DIR}/terms-runtime-password"
openssl rand -base64 32 > "${SECRET_DIR}/terms-migrator-password"
openssl rand -base64 32 > "${SECRET_DIR}/terms-retention-password"
openssl rand -base64 32 > "${SECRET_DIR}/terms-backup-password"
openssl rand -base64 48 > "${SECRET_DIR}/terms-internal-service-token"
openssl rand 32 > "${SECRET_DIR}/terms-fingerprint-key"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${SECRET_DIR}/dev-auth-private.pem" 2>/dev/null
openssl pkey -in "${SECRET_DIR}/dev-auth-private.pem" -pubout -out "${SECRET_DIR}/dev-auth-public.pem" 2>/dev/null

ROOT_DIR="${ROOT_DIR}" node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
import { importSPKI, exportJWK } from 'jose';
const root = process.env.ROOT_DIR;
const publicPem = await readFile(`${root}/deploy/local/.secrets/dev-auth-public.pem`, 'utf8');
const jwk = await exportJWK(await importSPKI(publicPem, 'RS256'));
await writeFile(`${root}/deploy/local/.secrets/jwks.json`, JSON.stringify({ keys: [{ ...jwk, alg: 'RS256', use: 'sig', kid: 'dev-rsa-1' }] }));
NODE

POSTGRES_PASSWORD="$(<"${SECRET_DIR}/postgres-password")"
ANALYST_TOKEN="$(cd "${ROOT_DIR}" && AUTH_ISSUER_HOST=http://dev-auth:8080 ./scripts/dev/issue-token.sh credit_analyst)"
SUPERVISOR_TOKEN="$(cd "${ROOT_DIR}" && AUTH_ISSUER_HOST=http://dev-auth:8080 ./scripts/dev/issue-token.sh supervisor)"
TERMS_ADMIN_TOKEN="$(cd "${ROOT_DIR}" && AUTH_ISSUER_HOST=http://dev-auth:8080 ./scripts/dev/issue-token.sh terms_admin)"
printf '%s' "${ANALYST_TOKEN}" > "${SECRET_DIR}/dev-analyst-token"
printf '%s' "${SUPERVISOR_TOKEN}" > "${SECRET_DIR}/dev-supervisor-token"
printf '%s' "${TERMS_ADMIN_TOKEN}" > "${SECRET_DIR}/dev-terms-admin-token"
# Docker Compose implements file-backed secrets as bind mounts and preserves the
# host mode. The containing directory remains owner-only; read-only files let the
# arbitrary non-root UIDs used by the containers consume those mounts.
chmod 0444 "${SECRET_DIR}"/*
cat > "${ENV_FILE}" <<'EOF'
# Los valores sensibles viven como archivos bajo .secrets y no se expanden en Compose.
LOCAL_SECRETS_READY=true
EOF
chmod 600 "${ENV_FILE}"
printf 'Secretos locales generados en deploy/local/.secrets y deploy/local/.env.secrets\n'
