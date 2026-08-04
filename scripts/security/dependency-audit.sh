#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="specs/001-alternative-credit-scoring/validation-evidence"
mkdir -p "${OUT_DIR}"
npm audit --json > "${OUT_DIR}/npm-root-audit.json" || true
npm --prefix frontend audit --json > "${OUT_DIR}/npm-frontend-audit.json" || true
npm --prefix services/ingestion audit --json > "${OUT_DIR}/npm-ingestion-audit.json" || true
printf 'Audits escritos en %s; el gate de release evalua severidad y mitigacion.\n' "${OUT_DIR}"
