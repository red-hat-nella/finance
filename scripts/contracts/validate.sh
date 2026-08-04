#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUBLIC="$ROOT/specs/001-alternative-credit-scoring/contracts/ingestion-public-v1.openapi.yaml"
INTERNAL="$ROOT/specs/001-alternative-credit-scoring/contracts/scoring-internal-v1.openapi.yaml"

cd "$ROOT"
npx redocly lint "$PUBLIC" "$INTERNAL"
npx redocly bundle "$PUBLIC" -o /tmp/ingestion-public-v1.bundle.yaml
npx redocly bundle "$INTERNAL" -o /tmp/scoring-internal-v1.bundle.yaml
node --test tests/contract/openapi-contracts.test.mjs
sha256sum "$PUBLIC" "$INTERNAL"

