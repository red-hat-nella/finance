#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PIPELINE="$ROOT/.tekton/pipeline.yaml"
[[ -s "$PIPELINE" ]] || { echo "pipeline missing" >&2; exit 1; }

PIPELINE="$PIPELINE" node --input-type=module <<'NODE'
import fs from 'node:fs';
import { parse } from 'yaml';
const pipeline = parse(fs.readFileSync(process.env.PIPELINE, 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(pipeline.apiVersion === 'tekton.dev/v1' && pipeline.kind === 'Pipeline', 'stable Tekton Pipeline API required');
const tasks = new Map((pipeline.spec?.tasks ?? []).map((task) => [task.name, task]));
const order = ['inspect', 'test', 'secure', 'build-frontend', 'build-ingestion', 'build-scoring', 'render', 'publish', 'promote', 'verify'];
for (const name of order) assert(tasks.has(name), `pipeline task missing: ${name}`);
for (let index = 1; index < order.length; index += 1) {
  assert(tasks.get(order[index]).runAfter?.includes(order[index - 1]), `${order[index]} must follow ${order[index - 1]}`);
}
assert((pipeline.spec?.finally ?? []).some((task) => task.name === 'report'), 'report must always run');
for (const result of ['frontend-digest', 'ingestion-digest', 'scoring-digest', 'evidence-ref']) {
  assert((pipeline.spec?.results ?? []).some((item) => item.name === result), `pipeline result missing: ${result}`);
}
NODE
echo "Tekton release DAG: PASS"
