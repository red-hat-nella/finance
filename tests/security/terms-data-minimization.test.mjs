import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseAllDocuments } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('rendered terms resources contain references but no Secret values', () => {
  const files = globSync('deploy/openshift/{base,overlays}/**/*.{yaml,yml}', { cwd: root });
  const rendered = files.map(read).join('\n---\n');
  const resources = parseAllDocuments(rendered).map((document) => document.toJSON()).filter(Boolean);
  assert.equal(resources.some((resource) => resource.kind === 'Secret'), false);
  for (const resource of resources) {
    assert.equal(resource.data?.['database-password'], undefined);
    assert.equal(resource.data?.['internal-service-token'], undefined);
    assert.equal(resource.stringData, undefined);
  }
});

test('terms logs never serialize authorization, legal content or raw identity fields', () => {
  const accessLog = read('services/terms-api/src/http/middleware/access-log.ts');
  assert.doesNotMatch(accessLog, /authorization|jwt|content|actorId|orgId|req\.body/i);
  const logger = read('services/terms-api/src/infrastructure/logging/logger.ts');
  for (const field of ['req.headers.authorization', 'req.body', 'content', 'actorId', 'orgId', 'actorFingerprint']) {
    assert.ok(logger.includes(`'${field}'`), `logger must redact ${field}`);
  }
});

test('tracked terms fixtures are explicitly synthetic and contain no credential shapes', () => {
  const fixtures = globSync('tests/fixtures/terms/*.{json,yaml,yml}', { cwd: root });
  assert.ok(fixtures.length >= 3);
  for (const file of fixtures) {
    const value = read(file);
    assert.match(value, /synthetic|sint[eé]tic/i, `${file} must disclose synthetic data`);
    assert.doesNotMatch(value, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[a-zA-Z0-9_-]{20,}\.|AKIA[0-9A-Z]{16}/);
    assert.doesNotMatch(value, /[A-Z0-9._%+-]+@(?!example\.(?:test|invalid))[A-Z0-9.-]+\.[A-Z]{2,}/i);
  }
});

test('terms repository contains no committed local secret directory', () => {
  const candidates = globSync('{deploy/local/.secrets/**,.env}', { cwd: root, dot: true });
  const ignore = read('.gitignore');
  assert.match(ignore, /\*\*\/\.secrets\//);
  assert.ok(candidates.every((file) => file === 'deploy/local/.secrets' || file.startsWith('deploy/local/.secrets/')));
});
