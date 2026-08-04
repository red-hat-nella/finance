#!/usr/bin/env bash
set -euo pipefail

FEATURE_DIR="specs/001-alternative-credit-scoring"
required=(
  ".specify/memory/constitution.md"
  "${FEATURE_DIR}/spec.md"
  "${FEATURE_DIR}/plan.md"
  "${FEATURE_DIR}/research.md"
  "${FEATURE_DIR}/design-system.md"
  "${FEATURE_DIR}/data-model.md"
  "${FEATURE_DIR}/quickstart.md"
  "${FEATURE_DIR}/tasks.md"
  "${FEATURE_DIR}/contracts/ingestion-public-v1.openapi.yaml"
  "${FEATURE_DIR}/contracts/scoring-internal-v1.openapi.yaml"
)
for path in "${required[@]}"; do
  [[ -s "${path}" ]] || { printf 'ERROR: falta %s\n' "${path}" >&2; exit 1; }
done
if grep -Eq '\[NEEDS CLARIFICATION\]|TBD|\[FEATURE NAME\]|TXXX' "${FEATURE_DIR}/spec.md" "${FEATURE_DIR}/plan.md"; then
  printf 'ERROR: existe una aclaracion o placeholder critico.\n' >&2
  exit 1
fi
grep -Fq 'Resultado pre-investigación**: **PASS' "${FEATURE_DIR}/plan.md"
grep -Fq 'Resultado post-diseño**: **PASS' "${FEATURE_DIR}/plan.md"
printf 'Artefactos SDD y gates constitucionales: PASS\n'
