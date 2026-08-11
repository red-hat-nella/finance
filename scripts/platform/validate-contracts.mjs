#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(import.meta.dirname, '../..');
const sensitiveKey = /(password|passwd|token|secret|private[-_]?key|kubeconfig)/i;
const credentialUrl = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@/i;

function parse(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assertSanitized(value, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSanitized(item, [...trail, String(index)]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (sensitiveKey.test(key) && key !== 'reference') {
        throw new Error(`sensitive field is forbidden at ${[...trail, key].join('.')}`);
      }
      assertSanitized(item, [...trail, key]);
    }
    return;
  }
  if (typeof value === 'string' && credentialUrl.test(value)) {
    throw new Error(`credential-bearing URL is forbidden at ${trail.join('.')}`);
  }
}

export function validateDocument(schemaPath, documentPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  const schema = parse(schemaPath);
  const document = parse(documentPath);
  assertSanitized(document);
  const validate = ajv.compile(schema);
  if (!validate(document)) {
    const detail = validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
    throw new Error(`${path.relative(root, documentPath)}: ${detail}`);
  }
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const contractDir = path.join(root, 'specs/002-openshift-runtime-requirements/contracts');
  const pairs = process.argv.includes('--all')
    ? [
        ['platform-profile.schema.json', 'deploy/openshift/overlays/dev/platform-profile.json'],
        ['platform-profile.schema.json', 'deploy/openshift/overlays/production/platform-profile.json'],
      ]
    : [[option('--schema'), option('--document')]];
  if (pairs.some(([schema, document]) => !schema || !document)) {
    throw new Error('usage: validate-contracts.mjs --all | --schema SCHEMA --document DOCUMENT');
  }
  for (const [schemaName, documentName] of pairs) {
    const schemaPath = path.isAbsolute(schemaName) ? schemaName : path.resolve(contractDir, schemaName);
    const documentPath = path.isAbsolute(documentName) ? documentName : path.resolve(root, documentName);
    validateDocument(schemaPath, documentPath);
    process.stdout.write(`contract valid: ${path.relative(root, documentPath)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
