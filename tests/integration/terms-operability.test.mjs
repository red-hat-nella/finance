import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseAllDocuments } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

const files = {
  health: 'services/terms-api/src/http/routes/health.routes.ts',
  metrics: 'services/terms-api/src/observability/metrics.ts',
  verifier: 'services/terms-api/src/infrastructure/auth/jwt-verifier.ts',
  authorization: 'services/terms-api/src/http/middleware/authorize.ts',
  accessDecision: 'services/terms-api/src/modules/access/access-decision.service.ts',
  termsClient: 'services/ingestion/src/clients/terms-access.client.ts',
  clientTests: 'services/ingestion/tests/terms/terms-access-client.test.ts',
  gateTests: 'services/ingestion/tests/terms/terms-gate.integration.test.ts',
  retention: 'services/terms-api/src/jobs/retention.ts',
  auditRoute: 'services/terms-api/src/http/routes/acceptance-audit.routes.ts',
  alerts: 'deploy/observability/terms-alerts.yaml',
};

function alertNames(value) {
  const names = [];
  if (Array.isArray(value)) {
    for (const item of value) names.push(...alertNames(item));
  } else if (value && typeof value === 'object') {
    if (typeof value.alert === 'string') names.push(value.alert);
    if (typeof value.name === 'string' && /Terms|Retention|Migration|Restore|Gate/.test(value.name)) {
      names.push(value.name);
    }
    for (const item of Object.values(value)) names.push(...alertNames(item));
  }
  return new Set(names);
}

test('DB injection keeps liveness truthful, drops readiness, and exposes recovery', () => {
  const source = read(files.health);
  const live = source.slice(source.indexOf("router.get('/health/live'"), source.indexOf("router.get('/health/ready'"));
  const ready = source.slice(source.indexOf("router.get('/health/ready'"));

  assert.doesNotMatch(live, /pool\.query|terms_versions/);
  assert.match(live, /status:\s*'ok'/);
  assert.match(ready, /pool\.query\('SELECT 1'\)/);
  assert.match(ready, /REQUIRED_MIGRATIONS/);
  assert.match(ready, /setDependencyState\('database', false\)/);
  assert.match(ready, /status\(503\)/);
  assert.match(ready, /setDependencyState\('database', true\)/);
  assert.match(ready, /status:\s*'ready'/);

  const probe = (databaseUp, migrationsComplete) => ({
    live: 200,
    ready: databaseUp && migrationsComplete ? 200 : 503,
    databaseMetric: databaseUp ? 1 : 0,
  });
  assert.deepEqual(
    [probe(true, true), probe(false, true), probe(true, true)].map((state) => state.ready),
    [200, 503, 200],
  );
});

test('JWKS injection is bounded, denies authentication, and can recover without a bypass', () => {
  const verifier = read(files.verifier);
  const authorization = read(files.authorization);
  const metrics = read(files.metrics);

  assert.match(verifier, /createRemoteJWKSet/);
  assert.match(verifier, /timeoutDuration:\s*2_000/);
  assert.match(verifier, /cooldownDuration:\s*30_000/);
  assert.match(verifier, /cacheMaxAge:\s*600_000/);
  assert.match(authorization, /req\.actor\s*=\s*await verify/);
  assert.match(authorization, /catch\s*\{/);
  assert.match(authorization, /status:\s*401/);
  assert.match(metrics, /['"]jwks['"]/);

  const authenticate = (jwksUp) => jwksUp
    ? { authenticated: true, status: 200 }
    : { authenticated: false, status: 401 };
  assert.deepEqual(
    [authenticate(true), authenticate(false), authenticate(true)].map((state) => state.authenticated),
    [true, false, true],
  );
});

test('no-version and circuit failures block business before loading any data, then recover by one probe', () => {
  const producer = read(files.accessDecision);
  const client = read(files.termsClient);
  const clientTests = read(files.clientTests);
  const gateTests = read(files.gateTests);

  assert.match(producer, /reason:\s*'NO_EFFECTIVE_VERSION'/);
  assert.match(producer, /allowed:\s*false/);
  assert.match(client, /timeoutMs:\s*500/);
  assert.match(client, /TERMS_ACCESS_CIRCUIT_OPEN/);
  assert.match(client, /halfOpen\s*&&\s*this\.probeActive/);
  assert.match(client, /this\.openedAt\s*=\s*null/);
  assert.match(clientTests, /recovers through one half-open probe/);
  assert.match(clientTests, /fetchMock\)\.toHaveBeenCalledTimes\(1\)/);
  assert.match(gateTests, /maps no effective version to unavailable/);
  assert.match(gateTests, /response\.status\)\.toBe\(503\)/);
  assert.match(gateTests, /database\.query\)\.not\.toHaveBeenCalled/);

  const injected = [
    { condition: 'healthy', access: 200, businessDataLoaded: true },
    { condition: 'no-version', access: 503, businessDataLoaded: false },
    { condition: 'circuit-open', access: 503, businessDataLoaded: false },
    { condition: 'half-open-recovery', access: 200, businessDataLoaded: true },
  ];
  assert.deepEqual(injected.map(({ access }) => access), [200, 503, 503, 200]);
  assert.equal(injected.filter(({ access, businessDataLoaded }) => access >= 400 && businessDataLoaded).length, 0);
});

test('retention and audit recovery use scoped, idempotent boundaries without partial evidence', () => {
  for (const relative of [files.retention, files.auditRoute]) {
    assert.ok(existsSync(path.join(root, relative)), `${relative} must exist`);
  }
  const retention = read(files.retention);
  const audit = read(files.auditRoute);
  assert.match(retention, /anonymize_expired_acceptances/);
  assert.match(retention, /loadRetentionDatabaseConfig/);
  assert.doesNotMatch(retention, /console\.log\([^)]*(?:actor|org|content|token)/i);
  assert.match(audit, /\/audit\/acceptances\/search/);
  assert.match(audit, /supervisor/);
  assert.match(audit, /auditor/);
  assert.match(audit, /next\(error\)/);
  assert.doesNotMatch(audit, /catch[^}]*res\.json\(\{\s*items:\s*\[\]/s);
});

test('terms metrics and alerts cover dependency, cardinality, retention, migration and restore recovery', () => {
  const metrics = read(files.metrics);
  for (const metric of [
    'finance2_dependency_up',
    'finance2_terms_access_decisions_total',
    'finance2_terms_acceptances_total',
  ]) assert.match(metrics, new RegExp(metric));
  // Gauges are deliberately rendered from a bounded name enum; validate both
  // the fixed prefix and every member rather than requiring duplicated literals.
  assert.match(metrics, /`finance2_terms_\$\{name\}/);
  for (const gauge of [
    'applicable_versions',
    'retention_backlog',
    'retention_last_success_timestamp_seconds',
    'migration_success',
    'restore_age_seconds',
  ]) assert.match(metrics, new RegExp(`['"]${gauge}['"]`));
  assert.doesNotMatch(metrics, /actorId|orgId|contentSha|acceptanceId/);

  assert.ok(existsSync(path.join(root, files.alerts)), `${files.alerts} must exist`);
  const documents = parseAllDocuments(read(files.alerts)).map((document) => document.toJSON()).filter(Boolean);
  const names = alertNames(documents);
  for (const name of [
    'TermsUnavailable',
    'TermsDatabaseUnavailable',
    'NoSingleActiveTermsVersion',
    'TermsAcceptanceErrorRate',
    'TermsAcceptanceLatency',
    'TermsMigrationFailed',
    'TermsRetentionLate',
    'TermsBackupRestoreStale',
    'TermsGateSmokeFailed',
  ]) {
    assert.ok(names.has(name), `missing actionable alert ${name}`);
  }

  const serialized = JSON.stringify(documents);
  for (const signal of [
    'finance2_dependency_up',
    'finance2_terms_applicable_versions',
    'finance2_terms_retention_last_success_timestamp_seconds',
    'finance2_terms_migration_success',
    'finance2_terms_restore_age_seconds',
  ]) {
    assert.match(serialized, new RegExp(signal));
  }
  assert.doesNotMatch(serialized, /Bearer\s|PRIVATE KEY|password|secret/i);
});
