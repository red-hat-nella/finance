#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUBLIC="$ROOT/specs/001-alternative-credit-scoring/contracts/ingestion-public-v1.openapi.yaml"
INTERNAL="$ROOT/specs/001-alternative-credit-scoring/contracts/scoring-internal-v1.openapi.yaml"
TERMS_PUBLIC="$ROOT/specs/003-accept-terms/contracts/terms-public-v1.openapi.yaml"
TERMS_INTERNAL="$ROOT/specs/003-accept-terms/contracts/terms-access-internal-v1.openapi.yaml"
CONTRACTS=("$PUBLIC" "$INTERNAL" "$TERMS_PUBLIC" "$TERMS_INTERNAL")

cd "$ROOT"
npx redocly lint "${CONTRACTS[@]}"
npx redocly bundle "$PUBLIC" -o /tmp/ingestion-public-v1.bundle.yaml
npx redocly bundle "$INTERNAL" -o /tmp/scoring-internal-v1.bundle.yaml
npx redocly bundle "$TERMS_PUBLIC" -o /tmp/terms-public-v1.bundle.yaml
npx redocly bundle "$TERMS_INTERNAL" -o /tmp/terms-access-internal-v1.bundle.yaml
node --test tests/contract/*.test.mjs
sha256sum "${CONTRACTS[@]}"
