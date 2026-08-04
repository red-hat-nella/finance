#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="${1:-deploy/images.lock}"
if grep -Eq '(^|[=:])(latest|edge)(@|$)' "${LOCK_FILE}"; then
  printf 'ERROR: no se permiten tags flotantes en %s\n' "${LOCK_FILE}" >&2
  exit 1
fi
grep -Eq '^frontend_build=' "${LOCK_FILE}"
grep -Eq '^frontend_runtime=' "${LOCK_FILE}"
grep -Eq '^ingestion=' "${LOCK_FILE}"
grep -Eq '^scoring=' "${LOCK_FILE}"
grep -Eq '^postgres_local=' "${LOCK_FILE}"
unresolved="$(grep -Ev '^(#|$)' "${LOCK_FILE}" | grep -vc '@sha256:' || true)"
if [[ "${unresolved}" -gt 0 ]]; then
  printf 'ERROR: %s referencia(s) requieren digest/autenticacion antes del release.\n' "${unresolved}" >&2
  exit 1
fi
printf 'Image lock valido: todas las referencias estan fijadas por sha256.\n'
