#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_REGISTRY="${IMAGE_REGISTRY:-localhost/alternative-credit-scoring}"
DESTINATION_REGISTRY="${PUBLISH_REGISTRY:?PUBLISH_REGISTRY is required}"
TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse HEAD)}"
OUT="${IMAGE_PUBLISH_OUTPUT:-$ROOT/build/images/published.json}"
[[ "$TAG" =~ ^[0-9a-f]{40}$ ]] || { echo "IMAGE_TAG must be the full commit SHA" >&2; exit 2; }
command -v skopeo >/dev/null || { echo "skopeo is required" >&2; exit 1; }

records="$(mktemp)"
trap 'rm -f "$records"' EXIT
for component in frontend ingestion scoring; do
  source="containers-storage:$SOURCE_REGISTRY/$component:$TAG"
  destination="$DESTINATION_REGISTRY/$component:$TAG"
  skopeo copy --all "$source" "docker://$destination" >/dev/null
  digest="$(skopeo inspect --format '{{.Digest}}' "docker://$destination")"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "invalid digest for $component" >&2; exit 1; }
  jq -n --arg component "$component" --arg repository "$DESTINATION_REGISTRY/$component" --arg digest "$digest" \
    '{component:$component,repository:$repository,digest:$digest}' >> "$records"
done

mkdir -p "$(dirname "$OUT")"
jq -s --arg commitSha "$TAG" \
  '{schemaVersion:"image-publish.finance2/v1",commitSha:$commitSha,images:map({key:.component,value:{repository:.repository,digest:.digest}})|from_entries}' \
  "$records" > "$OUT"
echo "immutable image metadata written: $OUT"
