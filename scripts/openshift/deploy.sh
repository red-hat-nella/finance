#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ACTION="${1:-render}"
OVERLAY="${2:-${OPENSHIFT_OVERLAY:-dev}}"
OVERLAY_DIR="$ROOT/deploy/openshift/overlays/$OVERLAY"
TIMEOUT="${OPENSHIFT_ROLLOUT_TIMEOUT:-5m}"

[[ -d "$OVERLAY_DIR" ]] || { echo "Overlay inexistente: $OVERLAY" >&2; exit 2; }

if command -v oc >/dev/null; then
  KUSTOMIZE_CLI=oc
elif command -v kubectl >/dev/null; then
  KUSTOMIZE_CLI=kubectl
else
  echo "Se requiere oc o kubectl para renderizar Kustomize." >&2
  exit 2
fi
if [[ "$ACTION" != render ]] && ! command -v oc >/dev/null; then
  echo "Se requiere el CLI oc para la acción $ACTION." >&2
  exit 2
fi

rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT
"$KUSTOMIZE_CLI" kustomize "$OVERLAY_DIR" > "$rendered"

namespace="$(node - "$rendered" <<'NODE'
const fs = require('node:fs');
const YAML = require('yaml');
const docs = YAML.parseAllDocuments(fs.readFileSync(process.argv[2], 'utf8'));
const item = docs.map((doc) => doc.toJSON()).find((value) => value?.metadata?.namespace);
process.stdout.write(item?.metadata?.namespace ?? '');
NODE
)"
[[ -n "$namespace" ]] || { echo "El overlay debe declarar namespace." >&2; exit 2; }

filter_documents() {
  local mode="$1"
  node - "$rendered" "$mode" <<'NODE'
const fs = require('node:fs');
const YAML = require('yaml');
const [file, mode] = process.argv.slice(2);
const values = YAML.parseAllDocuments(fs.readFileSync(file, 'utf8'))
  .map((doc) => doc.toJSON()).filter(Boolean);
const workloadKinds = new Set(['Deployment', 'CronJob', 'Route']);
const selected = values.filter((value) => {
  if (mode === 'bootstrap') return value.kind !== 'Job' && !workloadKinds.has(value.kind);
  if (mode === 'migration') return value.kind === 'Job' && value.metadata?.name === 'migrations';
  if (mode === 'workloads') return value.kind !== 'Job';
  return true;
});
process.stdout.write(selected.map((value) => YAML.stringify(value).trim()).join('\n---\n') + '\n');
NODE
}

case "$ACTION" in
  render)
    cat "$rendered"
    ;;
  dry-run)
    oc apply --dry-run=server -f "$rendered"
    ;;
  diff)
    oc diff -f "$rendered"
    ;;
  apply)
    oc get namespace "$namespace" >/dev/null 2>&1 || oc create namespace "$namespace"
    oc -n "$namespace" get secret scoring-secrets >/dev/null 2>&1 || {
      echo "Falta scoring-secrets en $namespace. Ejecute scripts/openshift/create-secrets.sh $namespace." >&2
      exit 3
    }

    filter_documents bootstrap | oc apply -f -
    if oc -n "$namespace" get statefulset/postgres >/dev/null 2>&1; then
      oc -n "$namespace" rollout status statefulset/postgres --timeout="$TIMEOUT"
    fi

    oc -n "$namespace" delete job migrations --ignore-not-found --wait=true >/dev/null
    filter_documents migration | oc apply -f -
    if ! oc -n "$namespace" wait --for=condition=complete job/migrations --timeout="$TIMEOUT"; then
      oc -n "$namespace" logs job/migrations --all-containers=true >&2 || true
      echo "ERROR: las migraciones fallaron; no se desplegaron los servicios." >&2
      exit 4
    fi

    filter_documents workloads | oc apply -f -
    for deployment in scoring ingestion frontend; do
      oc -n "$namespace" rollout status "deployment/$deployment" --timeout="$TIMEOUT"
    done
    echo "Despliegue $OVERLAY completado en $namespace; migration gate: PASS"
    ;;
  *)
    echo "Uso: $0 {render|dry-run|diff|apply} [dev|production]" >&2
    exit 2
    ;;
esac
