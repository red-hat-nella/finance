#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRET_DIR="${ROOT_DIR}/deploy/local/.secrets"
ENV_FILE="${ROOT_DIR}/deploy/local/.env.secrets"
mkdir -p "${SECRET_DIR}"
chmod 700 "${SECRET_DIR}"
umask 077

openssl rand -base64 32 > "${SECRET_DIR}/postgres-password"
openssl rand 32 > "${SECRET_DIR}/pii-encryption-key"
openssl rand 32 > "${SECRET_DIR}/pii-hmac-key"
openssl rand -base64 48 > "${SECRET_DIR}/scoring-service-token"
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
ANALYST_TOKEN="$(cd "${ROOT_DIR}" && ./scripts/dev/issue-token.sh credit_analyst)"
SUPERVISOR_TOKEN="$(cd "${ROOT_DIR}" && ./scripts/dev/issue-token.sh credit_supervisor)"
printf '%s' "${ANALYST_TOKEN}" > "${SECRET_DIR}/dev-analyst-token"
printf '%s' "${SUPERVISOR_TOKEN}" > "${SECRET_DIR}/dev-supervisor-token"
cat > "${ENV_FILE}" <<'EOF'
# Los valores sensibles viven como archivos bajo .secrets y no se expanden en Compose.
LOCAL_SECRETS_READY=true
EOF
chmod 600 "${ENV_FILE}"
printf 'Secretos locales generados en deploy/local/.secrets y deploy/local/.env.secrets\n'
