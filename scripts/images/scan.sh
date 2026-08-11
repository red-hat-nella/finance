#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${IMAGE_REGISTRY:-localhost/alternative-credit-scoring}"
TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse HEAD)}"
OUT="${IMAGE_SCAN_OUTPUT:-$ROOT/build/security}"
SYFT="docker.io/anchore/syft@sha256:392b65f29a410d2c1294d347bb3ad6f37608345ab6e7b43d2df03ea18bd6f5b0"
TRIVY="docker.io/aquasec/trivy@sha256:bcc376de8d77cfe086a917230e818dc9f8528e3c852f7b1aff648949b6258d1c"
mkdir -p "$OUT"
mkdir -p "$OUT/trivy-cache"
[[ "$TAG" =~ ^[0-9a-f]{40}$ ]] || { echo "IMAGE_TAG must be the full commit SHA" >&2; exit 2; }

for component in frontend ingestion scoring; do
  image="$REGISTRY/$component:$TAG"
  archive="$(mktemp --suffix=.tar)"
  podman save --format docker-archive -o "$archive" "$image"
  podman run --rm -v "$archive:/scan/image.tar:ro,Z" "$SYFT" \
    docker-archive:/scan/image.tar -o cyclonedx-json > "$OUT/$component.cdx.json"
  podman run --rm -v "$archive:/scan/image.tar:ro,Z" \
    -v "$OUT/trivy-cache:/root/.cache/trivy:Z" "$TRIVY" image \
    --input /scan/image.tar --scanners vuln --severity HIGH,CRITICAL \
    --ignore-unfixed --exit-code 1 --no-progress
  rm "$archive"
done

npm audit --audit-level=high --omit=dev
npm --prefix "$ROOT/frontend" audit --audit-level=high --omit=dev
npm --prefix "$ROOT/services/ingestion" audit --audit-level=high --omit=dev
echo "SBOM CycloneDX y vulnerabilidades HIGH/CRITICAL: PASS"
