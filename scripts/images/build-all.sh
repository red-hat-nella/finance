#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$ROOT/scripts/images/verify-lock.sh"
"$ROOT/scripts/images/build.sh"
"$ROOT/scripts/images/scan.sh"

echo "Build-once, SBOM, dependency audit and vulnerability gates for all five images: PASS"
