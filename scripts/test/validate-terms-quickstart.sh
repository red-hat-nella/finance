#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVIDENCE_FILE="${TERMS_QUICKSTART_EVIDENCE_FILE:-$ROOT/build/validation/terms/quickstart-evidence.json}"
RESTORE_EVIDENCE="$(mktemp)"
trap 'rm -f "$RESTORE_EVIDENCE"' EXIT

cd "$ROOT"
scripts/contracts/validate.sh --bundle
scripts/contracts/generate-terms-public.sh --check
scripts/contracts/generate-terms-internal.sh --check
npm exec --workspace @finance2/terms-api -- vitest run \
  --config vitest.integration.config.ts \
  tests/integration/migrations.test.ts \
  tests/integration/acceptance.test.ts \
  tests/integration/retention.test.ts
scripts/test/validate-terms-us2.sh
TERMS_US3_EVIDENCE_FILE="$(mktemp)" scripts/test/validate-terms-us3.sh
scripts/platform/verify-backup-restore --scope terms --evidence "$RESTORE_EVIDENCE"

cd "$ROOT/apps/terms-web"
npx playwright test tests/visual tests/accessibility --workers=1

cd "$ROOT"
restore_status="$(jq -r '.status // .result // "PENDING_VALIDATION"' "$RESTORE_EVIDENCE")"
restore_reason="$(jq -r '.reason // "validated against an isolated recovery target"' "$RESTORE_EVIDENCE")"
public_contract_sha="$(sha256sum specs/003-accept-terms/contracts/terms-public-v1.openapi.yaml | cut -d' ' -f1)"
internal_contract_sha="$(sha256sum specs/003-accept-terms/contracts/terms-access-internal-v1.openapi.yaml | cut -d' ' -f1)"
mkdir -p "$(dirname "$EVIDENCE_FILE")"
jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg restoreStatus "$restore_status" \
  --arg restoreReason "$restore_reason" \
  --arg publicContractSha "$public_contract_sha" \
  --arg internalContractSha "$internal_contract_sha" \
  '{
    schemaVersion: "terms-quickstart-evidence.finance2/v1",
    generatedAt: $generatedAt,
    classification: "SYNTHETIC_REDACTED",
    result: (if $restoreStatus == "PASS" then "PASS" else "PENDING_VALIDATION" end),
    checks: {
      contractBundles: {
        result: "PASS",
        termsPublicSha256: $publicContractSha,
        termsInternalSha256: $internalContractSha
      },
      generatedClientsCurrent: "PASS",
      migrationsAndAcceptance: "PASS",
      lifecycleSmoke: "PASS",
      retention: "PASS",
      restore: {result:$restoreStatus, reason:$restoreReason},
      liveGatewaySmoke: "PENDING_VALIDATION",
      visualAndAccessibility: {
        result: "PASS",
        viewports: ["320x568","375x667","768x1024","1024x768","1440x900"]
      }
    },
    notes: [
      "Live gateway smoke and isolated restore require the approved target platform.",
      "No token, actor identifier, legal content, acceptance row or raw response is retained."
    ]
  }' > "$EVIDENCE_FILE"
chmod 600 "$EVIDENCE_FILE"
echo "Terms reproducible quickstart: PASS; live platform checks=$restore_status ($EVIDENCE_FILE)"
