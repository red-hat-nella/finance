#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_DIR="${1:-$ROOT/specs/001-alternative-credit-scoring/contracts/baseline}"
CURRENT="$ROOT/specs/001-alternative-credit-scoring/contracts"

for contract in ingestion-public-v1.openapi.yaml scoring-internal-v1.openapi.yaml; do
  if [[ -f "$BASE_DIR/$contract" ]]; then
    npx redocly respect "$BASE_DIR/$contract" "$CURRENT/$contract"
  else
    echo "Sin baseline para $contract; lint y checks estructurales siguen siendo obligatorios."
  fi
done

