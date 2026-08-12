#!/usr/bin/env bash
set -euo pipefail

# Deterministic validation (default):
#   scripts/test/validate-terms-us3.sh
#
# Read-only HTTP verification against a healthy isolated local stack:
#   scripts/test/validate-terms-us3.sh --live
#
# The retained evidence is a fixed allowlist of check names and statuses. Test
# logs, JWTs, actor identifiers, acceptance rows, and response bodies are never
# copied to it or emitted by this script.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVIDENCE_FILE="${TERMS_US3_EVIDENCE_FILE:-$ROOT/build/validation/terms/us3-operability-evidence.json}"

usage() {
  cat <<'USAGE'
Uso: scripts/test/validate-terms-us3.sh [--live]

Sin opciones ejecuta validaciones deterministas de auditoría, retención,
inyección de fallos y recuperación, y guarda evidencia redactada.

--live  Añade probes, métricas y una búsqueda auditora vacía/read-only contra el
        stack local. Emite JWT sintético efímero y no imprime secretos/respuestas.

Variables live opcionales:
  TERMS_US3_BASE_URL               Gateway (default: http://127.0.0.1:8080)
  TERMS_US3_AUTH_PRIVATE_KEY_FILE  Clave del emisor dev local
  TERMS_US3_AUTH_ISSUER            Issuer interno (default: http://dev-auth:8080)
  TERMS_US3_AUTH_AUDIENCE          Audience (default: alternative-credit-scoring)
  TERMS_US3_EVIDENCE_FILE          Destino de evidencia redactada
USAGE
}

live=false
case "${1:-}" in
  '') ;;
  --live) live=true ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[[ $# -le 1 ]] || { usage >&2; exit 2; }

for command in node npm; do
  command -v "$command" >/dev/null || { echo 'Falta una dependencia de validación.' >&2; exit 127; }
done

required_tests=(
  services/terms-api/tests/integration/health.test.ts
  services/terms-api/tests/integration/acceptance-audit.test.ts
  services/terms-api/tests/integration/retention.test.ts
)
for relative in "${required_tests[@]}"; do
  [[ -f "$ROOT/$relative" ]] || { echo "Falta una prueba US3 requerida: $relative" >&2; exit 2; }
done

work="$(mktemp -d)"
cleanup() {
  find "$work" -type f -delete
  rmdir "$work"
}
trap cleanup EXIT

run_private() {
  local name="$1"
  shift
  if ! "$@" >"$work/$name.log" 2>&1; then
    echo "Falló la validación $name; salida omitida para proteger evidencia." >&2
    return 1
  fi
}

cd "$ROOT"
run_private operability node --test tests/integration/terms-operability.test.mjs
run_private api-us3 npm exec --workspace @finance2/terms-api -- \
  vitest run --config vitest.integration.config.ts \
  tests/integration/acceptance-audit.test.ts \
  tests/integration/retention.test.ts

live_status=SKIPPED
if [[ "$live" == true ]]; then
  command -v curl >/dev/null || { echo 'Falta una dependencia live.' >&2; exit 127; }
  base_url="${TERMS_US3_BASE_URL:-http://127.0.0.1:8080}"
  private_key="${TERMS_US3_AUTH_PRIVATE_KEY_FILE:-$ROOT/deploy/local/.secrets/dev-auth-private.pem}"
  issuer="${TERMS_US3_AUTH_ISSUER:-http://dev-auth:8080}"
  audience="${TERMS_US3_AUTH_AUDIENCE:-alternative-credit-scoring}"
  [[ -r "$private_key" ]] || {
    echo 'Falta la clave del emisor local; ejecute scripts/dev/init-local-secrets.sh.' >&2
    exit 2
  }

  auditor_header="$work/auditor.header"
  node --input-type=module - "$private_key" "$auditor_header" "$issuer" "$audience" <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
import { importPKCS8, SignJWT } from 'jose';

const [keyPath, headerPath, issuer, audience] = process.argv.slice(2);
const key = await importPKCS8(await readFile(keyPath, 'utf8'), 'RS256');
const subject = 'synthetic-terms-us3-auditor';
const jwt = await new SignJWT({
  org_id: 'synthetic-terms-us3-org',
  roles: ['auditor'],
  name: subject,
})
  .setProtectedHeader({ alg: 'RS256', kid: 'dev-rsa-1', typ: 'JWT' })
  .setIssuer(issuer)
  .setAudience(audience)
  .setSubject(subject)
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(key);
await writeFile(headerPath, `Authorization: Bearer ${jwt}`, { mode: 0o600 });
NODE

  run_private liveness curl -fsS --connect-timeout 3 --max-time 10 \
    -o "$work/liveness.json" "$base_url/terms-api/health/live"
  run_private readiness curl -fsS --connect-timeout 3 --max-time 10 \
    -o "$work/readiness.json" "$base_url/terms-api/health/ready"
  run_private metrics curl -fsS --connect-timeout 3 --max-time 10 \
    -o "$work/metrics.txt" "$base_url/terms-api/metrics"
  run_private audit curl -fsS --connect-timeout 3 --max-time 10 \
    -o "$work/audit.json" -X POST "$base_url/terms-api/v1/audit/acceptances/search" \
    -H "@$auditor_header" -H 'content-type: application/json' \
    -H 'X-Request-Id: 74000000-0000-4000-8000-000000000001' \
    -d '{"versionCode":"SYNTHETIC-US3-NONEXISTENT","limit":1}'

  LIVE_WORK="$work" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const directory = process.env.LIVE_WORK;
const json = async (name) => JSON.parse(await readFile(`${directory}/${name}`, 'utf8'));
assert.deepEqual(await json('liveness.json'), { status: 'ok', service: 'terms-api' });
assert.deepEqual(await json('readiness.json'), { status: 'ready', service: 'terms-api' });
const audit = await json('audit.json');
assert.ok(Array.isArray(audit.items));
assert.equal(audit.items.length, 0);
const metrics = await readFile(`${directory}/metrics.txt`, 'utf8');
for (const name of [
  'finance2_dependency_up',
  'finance2_terms_applicable_versions',
  'finance2_terms_retention_backlog',
  'finance2_terms_retention_last_success_timestamp_seconds',
]) assert.match(metrics, new RegExp(name));
assert.doesNotMatch(metrics, /actor|org|acceptance_id|content|token/i);
NODE
  live_status=PASS
fi

mkdir -p "$(dirname "$EVIDENCE_FILE")"
EVIDENCE_FILE="$EVIDENCE_FILE" LIVE_STATUS="$live_status" node --input-type=module <<'NODE'
import { writeFile } from 'node:fs/promises';

const evidence = {
  schemaVersion: 1,
  classification: 'SYNTHETIC_REDACTED',
  story: 'US3',
  status: 'PASS',
  checks: {
    auditScopeAndNoPartialFallback: 'PASS',
    retentionFiveYearIdempotency: 'PASS',
    databaseFailureAndRecovery: 'PASS',
    jwksFailureAndRecovery: 'PASS',
    circuitFailureAndRecovery: 'PASS',
    noEffectiveVersionFailClosed: 'PASS',
    truthfulProbes: 'PASS',
    metricsAndAlerts: 'PASS',
  },
  liveReadOnly: process.env.LIVE_STATUS,
  redaction: {
    tokens: 'OMITTED',
    actors: 'OMITTED',
    acceptanceRows: 'OMITTED',
    legalContent: 'OMITTED',
    rawLogs: 'OMITTED',
  },
};
await writeFile(process.env.EVIDENCE_FILE, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
NODE

echo "Terms US3 audit/retention recovery validation: PASS (live=$live_status)"
echo 'Redacted evidence written; sensitive and domain payloads omitted.'
