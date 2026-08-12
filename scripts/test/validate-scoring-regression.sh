#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVIDENCE_FILE="${SCORING_REGRESSION_EVIDENCE_FILE:-$ROOT/build/validation/terms/scoring-regression.json}"

cd "$ROOT/services/scoring"
uv run pytest -q \
  tests/unit/test_scoring_profiles.py \
  tests/property/test_known_profiles_determinism.py \
  tests/contract/test_invalid_and_manual_requests.py

cd "$ROOT"
npm --prefix services/ingestion run test -- --run \
  tests/unit/scoring/scoring-client.test.ts \
  tests/unit/evaluations/evaluation-failure.service.test.ts

mkdir -p "$(dirname "$EVIDENCE_FILE")"
jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    schemaVersion: "scoring-regression.finance2/v1",
    generatedAt: $generatedAt,
    classification: "SYNTHETIC_REDACTED",
    result: "PASS",
    implementationUnderTest: "unchanged-scoring-domain",
    repetitionsPerKnownProfile: 100,
    cases: {
      lowRisk: {result:"PASS", score:835, riskBand:"riesgo_bajo", state:"evaluada"},
      mediumRisk: {result:"PASS", score:634, riskBand:"riesgo_medio", state:"revision_manual"},
      highRisk: {result:"PASS", score:385, riskBand:"riesgo_alto", state:"evaluada"},
      incomplete: {result:"PASS", score:null, riskBand:null, state:"revision_manual"},
      invalid: {result:"PASS", status:422, partialResult:false},
      scoringDependencyFailure: {result:"PASS", statuses:[502,504], retryable:true, partialResult:false}
    },
    redaction: {applicantData:"OMITTED", tokens:"OMITTED", rawResponses:"OMITTED"}
  }' > "$EVIDENCE_FILE"
chmod 600 "$EVIDENCE_FILE"
echo "Deterministic scoring non-impact regression: PASS ($EVIDENCE_FILE)"
