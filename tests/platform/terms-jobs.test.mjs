import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseDocument } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const load = (name) => parseDocument(readFileSync(path.join(root, `deploy/openshift/base/jobs/${name}`), 'utf8')).toJSON();

test('terms migrations are a bounded PreSync job with isolated identity', () => {
  const job = load('terms-migrations-job.yaml');
  const pod = job.spec.template.spec;
  assert.equal(job.apiVersion, 'batch/v1');
  assert.equal(job.metadata.annotations['argocd.argoproj.io/hook'], 'PreSync');
  assert.equal(job.metadata.annotations['argocd.argoproj.io/sync-wave'], '-1');
  assert.equal(job.spec.activeDeadlineSeconds, 600);
  assert.equal(job.spec.ttlSecondsAfterFinished, 86400);
  assert.equal(pod.serviceAccountName, 'terms-migrations');
  assert.equal(pod.automountServiceAccountToken, false);
  assert.equal(pod.containers[0].env.find((item) => item.name === 'DATABASE_USER').value, 'terms_migrator');
  assert.match(pod.containers[0].image, /terms-api@sha256:[a-f0-9]{64}$/);
});

test('terms retention is daily, non-overlapping and separately credentialed', () => {
  const cron = load('terms-retention-cronjob.yaml');
  const job = cron.spec.jobTemplate.spec;
  const pod = job.template.spec;
  assert.equal(cron.apiVersion, 'batch/v1');
  assert.equal(cron.spec.concurrencyPolicy, 'Forbid');
  assert.match(cron.spec.schedule, /^\d+ \d+ \* \* \*$/);
  assert.equal(job.activeDeadlineSeconds, 900);
  assert.equal(job.ttlSecondsAfterFinished, 86400);
  assert.equal(pod.serviceAccountName, 'terms-retention');
  assert.equal(pod.automountServiceAccountToken, false);
  assert.equal(pod.containers[0].env.find((item) => item.name === 'DATABASE_USER').value, 'terms_retention');
  assert.equal(pod.containers[0].securityContext.readOnlyRootFilesystem, true);
});
