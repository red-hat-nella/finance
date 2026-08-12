import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import YAML from 'yaml';

const gatewayPath = 'frontend/nginx.conf';
const termsWebPath = 'apps/terms-web/nginx.conf';
const composePath = 'deploy/local/compose.yaml';

test('gateway gives terms prefixes precedence and maps each public URI correctly', async () => {
  const config = await readFile(gatewayPath, 'utf8');
  const termsWeb = config.indexOf('location ^~ /terms/');
  const termsApi = config.indexOf('location ^~ /terms-api/');
  const businessApi = config.indexOf('location /api/');
  const mainSpa = config.indexOf('location / {');

  assert.ok(termsWeb >= 0 && termsApi >= 0 && businessApi >= 0 && mainSpa >= 0);
  assert.ok(termsWeb < businessApi && termsApi < businessApi);
  assert.ok(termsWeb < mainSpa && termsApi < mainSpa);
  assert.match(config, /location \^~ \/terms\/\s*\{[\s\S]*?proxy_pass http:\/\/terms-web:8080;/);
  assert.match(config, /location \^~ \/terms-api\/\s*\{[\s\S]*?proxy_pass http:\/\/terms-api:8080\//);
  assert.doesNotMatch(config, /proxy_pass http:\/\/terms-web:8080\//);

  const termsBlocks = config.match(/location \^~ \/terms(?:-api)?\/[\s\S]*?\n    \}/g) ?? [];
  assert.equal(termsBlocks.length, 2);
  for (const block of termsBlocks) {
    assert.match(block, /proxy_set_header X-Request-Id \$request_id;/);
    assert.match(block, /add_header X-Request-Id \$request_id always;/);
  }
});

test('terms SPA owns fallback and only the gateway publishes a host port', async () => {
  const termsConfig = await readFile(termsWebPath, 'utf8');
  assert.match(termsConfig, /location \^~ \/terms\//);
  assert.match(termsConfig, /rewrite \^\/terms\/\(\.\*\)\$ \/\$1 last;/);
  assert.match(termsConfig, /try_files \$uri \$uri\/ \/index\.html;/);

  const compose = YAML.parse(await readFile(composePath, 'utf8'));
  assert.ok(compose.services.frontend.ports?.length > 0);
  for (const service of ['terms-web', 'terms-api', 'terms-migrations', 'terms-retention']) {
    assert.equal(compose.services[service].ports, undefined, `${service} must remain internal`);
    assert.deepEqual(compose.services[service].networks, ['backend']);
  }
  assert.equal(compose.networks.backend.internal, true);
});

test('local dependency graph is fail-closed and uses separated identities', async () => {
  const compose = YAML.parse(await readFile(composePath, 'utf8'));
  const services = compose.services;

  assert.equal(services['terms-api'].depends_on['terms-migrations'].condition, 'service_completed_successfully');
  assert.equal(services.ingestion.depends_on['terms-api'].condition, 'service_healthy');
  assert.equal(services.frontend.depends_on['terms-web'].condition, 'service_healthy');
  assert.equal(services.frontend.depends_on['terms-api'].condition, 'service_healthy');
  assert.equal(services['terms-retention'].profiles[0], 'jobs');
  assert.equal(services['terms-api'].environment.DATABASE_USER, 'terms_app');
  assert.equal(services['terms-migrations'].environment.DATABASE_USER, 'terms_migrator');
  assert.equal(services['terms-retention'].environment.DATABASE_USER, 'terms_retention');
  assert.deepEqual(services['terms-api'].secrets, [
    'terms_runtime_password',
    'terms_internal_service_token',
    'terms_fingerprint_key',
  ]);
  assert.deepEqual(services['terms-migrations'].secrets, ['terms_migrator_password']);
  assert.ok(
    services['terms-migrations'].volumes.includes(
      '../../db/terms-migrations:/opt/app-root/src/migrations:ro,Z',
    ),
  );
  assert.deepEqual(services['terms-retention'].secrets, ['terms_retention_password']);
});
