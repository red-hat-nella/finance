#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
GUIDE="$ROOT/specs/002-openshift-runtime-requirements/quickstart.md"
for script in discover render validate bootstrap verify smoke verify-persistence verify-backup-restore rollback generate-operations-doc validate-operations-doc; do
  [[ -x "$ROOT/scripts/platform/$script" ]] || { echo "quickstart script is not executable: $script" >&2; exit 1; }
done
for expected in \
  'build/platform/evidence/static' \
  'build/platform/evidence/dev/smoke.json' \
  'build/platform/evidence/dev/restore.json' \
  '--to-release HEALTHY_RELEASE' \
  '--propose-only' \
  '--render-root build/rendered' \
  '--cluster-profile build/platform/dev-profile.json'; do
  grep -Fq -- "$expected" "$GUIDE" || { echo "outdated or missing quickstart command: $expected" >&2; exit 1; }
done
for script in discover render validate bootstrap verify smoke verify-persistence verify-backup-restore rollback; do bash -n "$ROOT/scripts/platform/$script"; done
node --check "$ROOT/scripts/platform/generate-operations-doc"
node --check "$ROOT/scripts/platform/validate-operations-doc"
if grep -Eiq 'oc[[:space:]]+(get|describe)[[:space:]]+secrets?|kubectl[[:space:]]+(get|describe)[[:space:]]+secrets?' "$GUIDE"; then
  echo "quickstart must not query Secrets" >&2; exit 1
fi
echo "Quickstart safe procedures: PASS"
