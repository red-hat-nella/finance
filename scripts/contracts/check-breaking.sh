#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCORING_BASE_DIR="${1:-$ROOT/specs/001-alternative-credit-scoring/contracts/baseline}"
TERMS_BASE_DIR="${2:-$ROOT/specs/003-accept-terms/contracts/baseline}"
SCORING_CURRENT="$ROOT/specs/001-alternative-credit-scoring/contracts"
TERMS_CURRENT="$ROOT/specs/003-accept-terms/contracts"

check_contracts() {
  local baseline_dir="$1"
  local current_dir="$2"
  shift 2

  for contract in "$@"; do
    if [[ -f "$baseline_dir/$contract" ]]; then
      node --input-type=module - "$baseline_dir/$contract" "$current_dir/$contract" <<'NODE'
import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

const [baselinePath, currentPath] = process.argv.slice(2);
const baseline = YAML.parse(await readFile(baselinePath, 'utf8'));
const current = YAML.parse(await readFile(currentPath, 'utf8'));
const failures = [];
const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function localRef(document, value) {
  if (!value?.$ref?.startsWith('#/')) return value;
  return value.$ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((node, part) => node?.[part], document);
}

function compareSchema(oldSchema, newSchema, location, seen = new WeakMap()) {
  oldSchema = localRef(baseline, oldSchema);
  newSchema = localRef(current, newSchema);
  if (!oldSchema || !newSchema) {
    if (oldSchema && !newSchema) failures.push(`${location}: schema removed`);
    return;
  }
  if (typeof oldSchema !== 'object' || typeof newSchema !== 'object') return;
  const comparedWith = seen.get(oldSchema) ?? new WeakSet();
  if (comparedWith.has(newSchema)) return;
  comparedWith.add(newSchema);
  seen.set(oldSchema, comparedWith);

  const oldType = Array.isArray(oldSchema.type) ? [...oldSchema.type].sort().join(',') : oldSchema.type;
  const newType = Array.isArray(newSchema.type) ? [...newSchema.type].sort().join(',') : newSchema.type;
  if (oldType && newType && oldType !== newType) {
    failures.push(`${location}: type changed from ${oldType} to ${newType}`);
  }
  if (Array.isArray(oldSchema.enum) && Array.isArray(newSchema.enum)) {
    for (const value of oldSchema.enum) {
      if (!newSchema.enum.includes(value)) failures.push(`${location}: enum value ${JSON.stringify(value)} removed`);
    }
  }
  if (oldSchema.additionalProperties !== false && newSchema.additionalProperties === false) {
    failures.push(`${location}: additional properties are no longer accepted`);
  }

  const oldRequired = new Set(oldSchema.required ?? []);
  const newRequired = new Set(newSchema.required ?? []);
  for (const name of newRequired) {
    if (!oldRequired.has(name)) failures.push(`${location}: property ${name} became required`);
  }
  for (const [name, property] of Object.entries(oldSchema.properties ?? {})) {
    if (!(name in (newSchema.properties ?? {}))) {
      failures.push(`${location}: property ${name} removed`);
    } else {
      compareSchema(property, newSchema.properties[name], `${location}.${name}`, seen);
    }
  }
  if (oldSchema.items) compareSchema(oldSchema.items, newSchema.items, `${location}[]`, seen);
}

for (const [path, oldPathItem] of Object.entries(baseline.paths ?? {})) {
  const newPathItem = current.paths?.[path];
  if (!newPathItem) {
    failures.push(`${path}: path removed`);
    continue;
  }
  for (const method of methods) {
    const oldOperation = oldPathItem[method];
    if (!oldOperation) continue;
    const newOperation = newPathItem[method];
    const operationLocation = `${method.toUpperCase()} ${path}`;
    if (!newOperation) {
      failures.push(`${operationLocation}: operation removed`);
      continue;
    }

    const oldParameters = [...(oldPathItem.parameters ?? []), ...(oldOperation.parameters ?? [])]
      .map((value) => localRef(baseline, value));
    const newParameters = [...(newPathItem.parameters ?? []), ...(newOperation.parameters ?? [])]
      .map((value) => localRef(current, value));
    for (const oldParameter of oldParameters) {
      const match = newParameters.find((value) => value?.name === oldParameter?.name && value?.in === oldParameter?.in);
      if (!match) failures.push(`${operationLocation}: parameter ${oldParameter?.in}:${oldParameter?.name} removed`);
      else compareSchema(oldParameter.schema, match.schema, `${operationLocation} parameter ${oldParameter.name}`);
    }
    for (const newParameter of newParameters) {
      const existed = oldParameters.some((value) => value?.name === newParameter?.name && value?.in === newParameter?.in);
      if (!existed && newParameter?.required) failures.push(`${operationLocation}: required parameter ${newParameter.in}:${newParameter.name} added`);
    }

    const oldBody = localRef(baseline, oldOperation.requestBody);
    const newBody = localRef(current, newOperation.requestBody);
    if (!oldBody && newBody?.required) failures.push(`${operationLocation}: required request body added`);
    if (oldBody && !newBody) failures.push(`${operationLocation}: request body removed`);
    for (const [mediaType, oldMedia] of Object.entries(oldBody?.content ?? {})) {
      const newMedia = newBody?.content?.[mediaType];
      if (!newMedia) failures.push(`${operationLocation}: request media type ${mediaType} removed`);
      else compareSchema(oldMedia.schema, newMedia.schema, `${operationLocation} request ${mediaType}`);
    }

    for (const [status, oldResponseValue] of Object.entries(oldOperation.responses ?? {})) {
      const newResponseValue = newOperation.responses?.[status];
      if (!newResponseValue) {
        failures.push(`${operationLocation}: response ${status} removed`);
        continue;
      }
      const oldResponse = localRef(baseline, oldResponseValue);
      const newResponse = localRef(current, newResponseValue);
      for (const [mediaType, oldMedia] of Object.entries(oldResponse?.content ?? {})) {
        const newMedia = newResponse?.content?.[mediaType];
        if (!newMedia) failures.push(`${operationLocation}: response ${status} media type ${mediaType} removed`);
        else compareSchema(oldMedia.schema, newMedia.schema, `${operationLocation} response ${status} ${mediaType}`);
      }
    }
  }
}

for (const [name, oldScheme] of Object.entries(baseline.components?.securitySchemes ?? {})) {
  const newScheme = current.components?.securitySchemes?.[name];
  if (!newScheme) failures.push(`security scheme ${name} removed`);
  else if (oldScheme.type !== newScheme.type) failures.push(`security scheme ${name} changed type`);
}

if (failures.length > 0) {
  console.error(`Breaking changes detected in ${currentPath}:`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Compatibilidad OpenAPI: PASS (${baselinePath} -> ${currentPath})`);
NODE
    else
      echo "Sin baseline para $contract; lint y checks estructurales siguen siendo obligatorios."
    fi
  done
}

check_contracts "$SCORING_BASE_DIR" "$SCORING_CURRENT" \
  ingestion-public-v1.openapi.yaml scoring-internal-v1.openapi.yaml
check_contracts "$TERMS_BASE_DIR" "$TERMS_CURRENT" \
  terms-public-v1.openapi.yaml terms-access-internal-v1.openapi.yaml
