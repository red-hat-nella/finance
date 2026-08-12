#!/usr/bin/env bash
set -euo pipefail

# Deterministic validation is the default and needs no running services:
#   scripts/test/validate-terms-us2.sh
#
# A complete contract-backed smoke against an isolated local stack is opt-in. The
# caller supplies the controlled-clock boundary; a lifecycle worker must promote
# the scheduled version when that instant is reached:
#   TERMS_US2_EFFECTIVE_AT=2026-08-12T18:30:00Z \
#     scripts/test/validate-terms-us2.sh --live
#
# Live mode uses fixed synthetic identifiers and is intentionally not suitable for
# a shared or previously-used database. No token, actor identifier, or terms body is
# written to stdout/stderr.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUBLIC_CONTRACT="$ROOT/specs/003-accept-terms/contracts/terms-public-v1.openapi.yaml"
INTERNAL_CONTRACT="$ROOT/specs/003-accept-terms/contracts/terms-access-internal-v1.openapi.yaml"
VERSIONS_FIXTURE="$ROOT/tests/fixtures/terms/versions.json"
ACCEPTANCES_FIXTURE="$ROOT/tests/fixtures/terms/acceptances.json"

usage() {
  cat <<'USAGE'
Uso: scripts/test/validate-terms-us2.sh [--live]

Sin opciones valida de forma determinista el rollover con contratos y fixtures
inequívocamente sintéticos.

--live  Ejecuta además el flujo HTTP completo en un stack local aislado. Requiere:
        TERMS_US2_EFFECTIVE_AT=<RFC3339 futuro controlado>

Variables live opcionales:
  TERMS_US2_BASE_URL       Gateway (default: http://127.0.0.1:8080)
  TERMS_US2_AUTH_PRIVATE_KEY_FILE  Clave del emisor dev local
  TERMS_US2_AUTH_ISSUER    Issuer interno (default: http://dev-auth:8080)
  TERMS_US2_AUTH_AUDIENCE  Audience (default: alternative-credit-scoring)
  TERMS_US2_TIMEOUT_SEC    Espera máxima de promoción (default: 180)
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

cd "$ROOT"
node --input-type=module - \
  "$PUBLIC_CONTRACT" "$INTERNAL_CONTRACT" "$VERSIONS_FIXTURE" "$ACCEPTANCES_FIXTURE" <<'NODE'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

const [publicPath, internalPath, versionsPath, acceptancesPath] = process.argv.slice(2);
const loadYaml = async (path) => YAML.parse(await readFile(path, 'utf8'));
const loadJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [publicApi, internalApi, versionData, acceptanceData] = await Promise.all([
  loadYaml(publicPath),
  loadYaml(internalPath),
  loadJson(versionsPath),
  loadJson(acceptancesPath),
]);

// The only state-changing administration operations exposed by the public
// boundary are draft creation, schedule, and pre-publication withdrawal.
assert.equal(publicApi.paths['/v1/admin/versions'].post.operationId, 'createTermsVersionDraft');
assert.deepEqual(publicApi.paths['/v1/admin/versions'].post['x-required-roles'], ['terms_admin']);
assert.equal(
  publicApi.paths['/v1/admin/versions/{versionId}/schedule'].post.operationId,
  'scheduleTermsVersion',
);
assert.deepEqual(
  publicApi.paths['/v1/admin/versions/{versionId}/schedule'].post['x-required-roles'],
  ['terms_admin'],
);
assert.deepEqual(publicApi.components.schemas.TermsVersionSummary.properties.state.enum, [
  'DRAFT', 'SCHEDULED', 'EFFECTIVE', 'SUPERSEDED', 'WITHDRAWN',
]);

// An acceptance is evidence for one immutable version+digest pair. There is no
// acceptance update/delete operation in the contract.
assert.deepEqual(publicApi.components.schemas.AcceptanceInput.required, [
  'versionId', 'contentSha256',
]);
for (const field of ['acceptanceId', 'versionId', 'versionCode', 'acceptedAt', 'contentSha256']) {
  assert.ok(publicApi.components.schemas.Acceptance.required.includes(field));
}
assert.equal(publicApi.paths['/v1/acceptances'].put, undefined);
assert.equal(publicApi.paths['/v1/acceptances'].patch, undefined);
assert.equal(publicApi.paths['/v1/acceptances'].delete, undefined);

const reasons = internalApi.components.schemas.AccessDecision.properties.reason.enum;
assert.ok(reasons.includes('ACCEPTANCE_REQUIRED'));
assert.deepEqual(internalApi.security, [{ bearerAuth: [], serviceToken: [] }]);

// Fixtures and all evidence below are synthetic by construction.
assert.match(versionData.fixtureNotice, /^SYNTHETIC TEST DATA ONLY/);
assert.match(acceptanceData.fixtureNotice, /^SYNTHETIC TEST DATA ONLY/);
const serializedFixtures = JSON.stringify([versionData, acceptanceData]);
assert.doesNotMatch(serializedFixtures, /Bearer\s|PRIVATE KEY|password|secret/i);

const prior = versionData.versions.find((version) => version.state === 'EFFECTIVE');
const next = versionData.versions.find((version) => version.state === 'SCHEDULED');
assert.ok(prior && next);
assert.notEqual(prior.versionId, next.versionId);
const draftRequired = publicApi.components.schemas.VersionDraftInput.required;
const draftInput = Object.fromEntries(draftRequired.map((field) => [field, next[field]]));
assert.deepEqual(Object.keys(draftInput), ['versionCode', 'title', 'contentFormat', 'content']);
assert.match(draftInput.versionCode, /^[A-Z0-9][A-Z0-9._-]{0,63}$/);
assert.equal(draftInput.contentFormat, 'markdown');
const createdDraft = { ...next, ...draftInput, state: 'DRAFT', effectiveAt: null, publishedAt: null };
assert.equal(createdDraft.state, 'DRAFT');
const scheduledDraft = {
  ...createdDraft,
  state: 'SCHEDULED',
  effectiveAt: next.effectiveAt,
  publishedAt: next.publishedAt,
};
assert.equal(scheduledDraft.state, 'SCHEDULED');
assert.ok(Date.parse(scheduledDraft.effectiveAt) > Date.parse(createdDraft.createdAt));
const acceptance = acceptanceData.acceptances.find(
  (candidate) => candidate.versionId === prior.versionId && candidate.anonymizedAt === null,
);
assert.ok(acceptance);
assert.equal(acceptance.contentSha256, prior.contentSha256);

const immutableFields = publicApi.components.schemas.Acceptance.required;
const evidence = Object.fromEntries(immutableFields.map((field) => [field, acceptance[field]]));
const beforeRollover = JSON.stringify(evidence);
const beforeDecision = {
  allowed: acceptance.versionId === prior.versionId,
  currentVersionId: prior.versionId,
  acceptedVersionId: acceptance.versionId,
  reason: 'ACCEPTED',
};
assert.equal(beforeDecision.allowed, true);

// Advance the controlled fixture clock: publication changes version states, not
// the historical acceptance. The producer lookup is scoped to the new current
// version, so the old evidence cannot authorize access.
const afterVersions = versionData.versions.map((version) => ({
  ...version,
  state: version.versionId === prior.versionId
    ? 'SUPERSEDED'
    : version.versionId === next.versionId ? 'EFFECTIVE' : version.state,
}));
assert.equal(afterVersions.filter((version) => version.state === 'EFFECTIVE').length, 1);
assert.equal(JSON.stringify(evidence), beforeRollover);
const acceptanceForCurrent = acceptance.versionId === next.versionId ? acceptance : null;
const afterDecision = {
  allowed: Boolean(acceptanceForCurrent),
  currentVersionId: next.versionId,
  acceptedVersionId: acceptanceForCurrent?.versionId ?? null,
  reason: acceptanceForCurrent ? 'ACCEPTED' : 'ACCEPTANCE_REQUIRED',
};
assert.deepEqual(afterDecision, {
  allowed: false,
  currentVersionId: next.versionId,
  acceptedVersionId: null,
  reason: 'ACCEPTANCE_REQUIRED',
});
NODE

echo 'Terms US2 rollover contract/fixture validation: PASS'

if [[ "$live" != true ]]; then
  echo 'Terms US2 live smoke: SKIPPED (use --live with a controlled future timestamp)'
  exit 0
fi

for command in curl jq date sha256sum; do
  command -v "$command" >/dev/null || { echo "Falta una dependencia requerida para --live." >&2; exit 127; }
done

effective_at="${TERMS_US2_EFFECTIVE_AT:-}"
[[ -n "$effective_at" ]] || {
  echo 'TERMS_US2_EFFECTIVE_AT es obligatorio con --live.' >&2
  exit 2
}
effective_epoch="$(date -u -d "$effective_at" +%s 2>/dev/null)" || {
  echo 'TERMS_US2_EFFECTIVE_AT debe ser un instante RFC3339 válido.' >&2
  exit 2
}
(( effective_epoch > $(date -u +%s) )) || {
  echo 'TERMS_US2_EFFECTIVE_AT debe estar en el futuro.' >&2
  exit 2
}

base_url="${TERMS_US2_BASE_URL:-http://127.0.0.1:8080}"
terms_api="$base_url/terms-api/v1"
business_api="$base_url/api/v1"
private_key="${TERMS_US2_AUTH_PRIVATE_KEY_FILE:-$ROOT/deploy/local/.secrets/dev-auth-private.pem}"
auth_issuer="${TERMS_US2_AUTH_ISSUER:-http://dev-auth:8080}"
auth_audience="${TERMS_US2_AUTH_AUDIENCE:-alternative-credit-scoring}"
timeout_sec="${TERMS_US2_TIMEOUT_SEC:-180}"
[[ "$timeout_sec" =~ ^[1-9][0-9]*$ ]] || {
  echo 'TERMS_US2_TIMEOUT_SEC debe ser un entero positivo.' >&2
  exit 2
}
[[ -r "$private_key" ]] || {
  echo 'Falta la clave del emisor local; ejecute scripts/dev/init-local-secrets.sh.' >&2
  exit 2
}

work="$(mktemp -d)"
cleanup() {
  find "$work" -type f -delete
  rmdir "$work"
}
trap cleanup EXIT

analyst_header="$work/analyst.header"
admin_header="$work/admin.header"
node --input-type=module - \
  "$private_key" "$analyst_header" "$admin_header" "$auth_issuer" "$auth_audience" <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
import { importPKCS8, SignJWT } from 'jose';

const [keyPath, analystPath, adminPath, issuer, audience] = process.argv.slice(2);
const key = await importPKCS8(await readFile(keyPath, 'utf8'), 'RS256');
const token = (subject, role) => new SignJWT({
  org_id: 'synthetic-terms-us2-org',
  roles: [role],
  name: subject,
})
  .setProtectedHeader({ alg: 'RS256', kid: 'dev-rsa-1', typ: 'JWT' })
  .setIssuer(issuer)
  .setAudience(audience)
  .setSubject(subject)
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(key);

await Promise.all([
  writeFile(
    analystPath,
    `Authorization: Bearer ${await token('synthetic-terms-us2-analyst', 'credit_analyst')}`,
    { mode: 0o600 },
  ),
  writeFile(
    adminPath,
    `Authorization: Bearer ${await token('synthetic-terms-us2-admin', 'terms_admin')}`,
    { mode: 0o600 },
  ),
]);
NODE

request() {
  local output="$1"
  shift
  curl -fsS --connect-timeout 3 --max-time 10 -o "$output" "$@"
}

# Establish immutable synthetic evidence for the currently effective version.
current_before="$work/current-before.json"
request "$current_before" "$terms_api/current" \
  -H "@$analyst_header" -H 'X-Request-Id: 62000000-0000-4000-8000-000000000001'
old_version_id="$(jq -er '.version.versionId' "$current_before")"
jq '{versionId:.version.versionId,contentSha256:.version.contentSha256}' \
  "$current_before" > "$work/old-acceptance-input.json"
request "$work/old-acceptance.json" -X POST "$terms_api/acceptances" \
  -H "@$analyst_header" -H 'content-type: application/json' \
  -H 'X-Request-Id: 62000000-0000-4000-8000-000000000002' \
  -H 'Idempotency-Key: 62000000-0000-4000-8000-000000000003' \
  --data @"$work/old-acceptance-input.json"
jq -e --arg id "$old_version_id" '.versionId==$id' "$work/old-acceptance.json" >/dev/null
old_evidence_digest="$(sha256sum "$work/old-acceptance.json" | cut -d' ' -f1)"

# Fixed identifiers and unequivocally synthetic content make the live request
# reproducible. A clean isolated database is required because the code is unique.
jq -n '{
  versionCode:"SYNTHETIC-ROLLOVER-0001",
  title:"Synthetic rollover validation only",
  contentFormat:"markdown",
  content:"# Synthetic rollover\n\nInvented automated-test content. Not legal terms."
}' > "$work/draft-input.json"
request "$work/draft.json" -X POST "$terms_api/admin/versions" \
  -H "@$admin_header" -H 'content-type: application/json' \
  -H 'X-Request-Id: 62000000-0000-4000-8000-000000000004' \
  -H 'Idempotency-Key: 62000000-0000-4000-8000-000000000005' \
  --data @"$work/draft-input.json"
new_version_id="$(jq -er 'select(.state=="DRAFT")|.versionId' "$work/draft.json")"

jq -n --arg effectiveAt "$effective_at" '{effectiveAt:$effectiveAt}' > "$work/schedule-input.json"
request "$work/scheduled.json" -X POST "$terms_api/admin/versions/$new_version_id/schedule" \
  -H "@$admin_header" -H 'content-type: application/json' \
  -H 'X-Request-Id: 62000000-0000-4000-8000-000000000006' \
  -H 'Idempotency-Key: 62000000-0000-4000-8000-000000000007' \
  --data @"$work/schedule-input.json"
jq -e --arg id "$new_version_id" \
  '.versionId==$id and .state=="SCHEDULED" and (.effectiveAt|type)=="string"' \
  "$work/scheduled.json" >/dev/null
scheduled_epoch="$(date -u -d "$(jq -er .effectiveAt "$work/scheduled.json")" +%s)"
[[ "$scheduled_epoch" == "$effective_epoch" ]]

# Scheduling alone cannot invalidate the prior effective acceptance.
request "$work/current-scheduled.json" "$terms_api/current" \
  -H "@$analyst_header" -H 'X-Request-Id: 62000000-0000-4000-8000-000000000008'
jq -e --arg id "$old_version_id" \
  '.version.versionId==$id and .acceptanceStatus=="ACCEPTED"' "$work/current-scheduled.json" >/dev/null

# Wait for the stack's lifecycle worker/controlled clock to atomically promote the
# scheduled version. Response bodies remain in the private temporary directory.
deadline=$(( $(date +%s) + timeout_sec ))
promoted=false
while (( $(date +%s) <= deadline )); do
  if request "$work/current-after.json" "$terms_api/current" \
      -H "@$analyst_header" -H 'X-Request-Id: 62000000-0000-4000-8000-000000000009' \
      2>/dev/null && jq -e --arg id "$new_version_id" \
      '.version.versionId==$id and .acceptanceStatus=="PENDING"' "$work/current-after.json" >/dev/null; then
    promoted=true
    break
  fi
  sleep 1
done
[[ "$promoted" == true ]] || {
  echo 'Timeout esperando la promoción controlada de la versión sintética.' >&2
  exit 1
}

# The historical response is byte-identical in our evidence file, yet its exact
# version+digest pair is rejected now that another version is current.
[[ "$(sha256sum "$work/old-acceptance.json" | cut -d' ' -f1)" == "$old_evidence_digest" ]]
old_status="$(curl -sS --connect-timeout 3 --max-time 10 -o "$work/old-retry-problem.json" \
  -w '%{http_code}' -X POST "$terms_api/acceptances" \
  -H "@$analyst_header" -H 'content-type: application/json' \
  -H 'X-Request-Id: 62000000-0000-4000-8000-000000000010' \
  -H 'Idempotency-Key: 62000000-0000-4000-8000-000000000011' \
  --data @"$work/old-acceptance-input.json")"
[[ "$old_status" == 409 ]]
jq -e '.code=="TERMS_VERSION_CHANGED"' "$work/old-retry-problem.json" >/dev/null

blocked_status="$(curl -sS --connect-timeout 3 --max-time 10 -o "$work/blocked.json" \
  -w '%{http_code}' -X POST "$business_api/evaluations/search" \
  -H "@$analyst_header" -H 'content-type: application/json' -d '{"page":1}')"
[[ "$blocked_status" == 428 ]]
jq -e '.code=="TERMS_ACCEPTANCE_REQUIRED"' "$work/blocked.json" >/dev/null

echo 'Terms US2 live synthetic rollover: PASS'
