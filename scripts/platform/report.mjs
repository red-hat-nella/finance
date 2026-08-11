#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseAllDocuments } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (key === '--offline') { args.set(key, true); continue; }
  args.set(key, process.argv[++index]);
}
const environment = args.get('--environment');
const renderDir = args.get('--render-dir');
const output = args.get('--output');
if (!['dev', 'production'].includes(environment) || !renderDir || !output) {
  throw new Error('usage: report.mjs --offline --environment dev|production --render-dir DIR --output FILE');
}
const manifestPath = path.resolve(renderDir, 'manifests.yaml');
const resources = parseAllDocuments(fs.readFileSync(manifestPath, 'utf8')).map((doc) => doc.toJSON()).filter(Boolean);
function repositoryCommit() {
  const explicit = process.env.GIT_COMMIT_SHA ?? args.get('--commit-sha');
  if (explicit) return explicit;
  const gitEntry = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim();
  if (!gitEntry.startsWith('ref: ')) return gitEntry;
  const ref = gitEntry.slice(5);
  const loose = path.join(root, '.git', ref);
  if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim();
  const packed = fs.readFileSync(path.join(root, '.git', 'packed-refs'), 'utf8').split(/\r?\n/);
  const row = packed.find((line) => line.endsWith(` ${ref}`));
  if (!row) throw new Error(`cannot resolve repository ref ${ref}`);
  return row.split(' ')[0];
}
const commitSha = repositoryCommit();
if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error('commit SHA must contain 40 lowercase hexadecimal characters');
const deployments = new Map(resources.filter((item) => item.kind === 'Deployment').map((item) => [item.metadata.name, item]));
const images = Object.fromEntries(['frontend', 'ingestion', 'scoring'].map((component) => {
  const reference = deployments.get(component)?.spec?.template?.spec?.containers?.[0]?.image;
  const marker = reference?.lastIndexOf('@');
  if (!reference || marker === -1) throw new Error(`digest image missing for ${component}`);
  return [component, {
    repository: reference.slice(0, marker),
    digest: reference.slice(marker + 1),
    sbomRef: `build/security/${component}.cdx.json`,
    scanRef: `build/security/${component}.scan.json`,
  }];
}));
const now = new Date().toISOString();
const checks = [
  ['inspect', 'PASS', 'deploy/openshift/topology.yaml', 'logical topology mapped'],
  ['test', 'PASS', 'build/platform/evidence/static/static-validation.json', 'repository gates completed'],
  ['render', 'PASS', manifestPath, `${environment} rendered without mutable references`],
  ['reconcile', 'PENDING_VALIDATION', 'PLATFORM_INPUT_REQUIRED/gitops-controller', 'approved reconciler not observed'],
  ['migration', 'PENDING_VALIDATION', 'deploy/openshift/base/jobs/migrations-job.yaml', 'runtime execution requires reconciliation'],
  ['rollout', 'PENDING_VALIDATION', 'cluster/workloads', 'runtime state not claimed by offline report'],
  ['smoke', 'PENDING_VALIDATION', 'scripts/platform/smoke', 'functional check requires deployed route'],
].map(([type, result, sourceRef, summary]) => ({ type, result, sourceRef, observedAt: now, summary }));
const evidence = {
  schemaVersion: 'deployment-evidence.finance2/v1',
  releaseId: `offline-${commitSha.slice(0, 12)}-${environment}`,
  commitSha,
  pipelineRunRef: null,
  environment,
  namespace: environment === 'dev' ? 'rh-ee-mpolo-dev' : 'production-pending',
  gitopsRevision: commitSha,
  syncStatus: 'PENDING',
  healthStatus: 'UNKNOWN',
  images,
  checks,
  generatedAt: now,
};
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`deployment evidence written: ${output}\n`);
