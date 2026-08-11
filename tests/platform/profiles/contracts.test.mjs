import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateDocument } from '../../../scripts/platform/validate-contracts.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const profileSchema = path.join(root, 'specs/002-openshift-runtime-requirements/contracts/platform-profile.schema.json');
const evidenceSchema = path.join(root, 'specs/002-openshift-runtime-requirements/contracts/deployment-evidence.schema.json');

test('accepts declared dev and production profiles', () => {
  assert.doesNotThrow(() => validateDocument(profileSchema, path.join(import.meta.dirname, 'fixtures/platform-profile.valid.json')));
  for (const environment of ['dev', 'production']) {
    assert.doesNotThrow(() => validateDocument(profileSchema, path.join(root, `deploy/openshift/overlays/${environment}/platform-profile.json`)));
  }
});

test('accepts a sanitized deployment evidence record', () => {
  assert.doesNotThrow(() => validateDocument(evidenceSchema, path.join(import.meta.dirname, 'fixtures/deployment-evidence.valid.json')));
});

test('rejects malformed profiles and sensitive fields', () => {
  assert.throws(() => validateDocument(profileSchema, path.join(import.meta.dirname, 'fixtures/platform-profile.invalid.json')));
  const temp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'finance2-contract-')), 'evidence.json');
  const evidence = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/deployment-evidence.valid.json'), 'utf8'));
  evidence.databasePassword = 'not-a-real-password';
  fs.writeFileSync(temp, JSON.stringify(evidence));
  assert.throws(() => validateDocument(evidenceSchema, temp), /sensitive field/);
});
