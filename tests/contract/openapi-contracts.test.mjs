import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import YAML from 'yaml';

const contracts = [
  ['public', 'specs/001-alternative-credit-scoring/contracts/ingestion-public-v1.openapi.yaml'],
  ['internal', 'specs/001-alternative-credit-scoring/contracts/scoring-internal-v1.openapi.yaml'],
];

for (const [name, file] of contracts) {
  test(`${name} contract is versioned and complete`, async () => {
    const api = YAML.parse(await readFile(file, 'utf8'));
    assert.equal(api.openapi, '3.1.0');
    assert.equal(api.info.version, '1.0.0');
    assert.ok(Object.keys(api.paths).length >= 3);
    assert.ok(api.components.schemas.Problem);
    assert.ok(api.components.schemas.HealthResponse);
    const operations = Object.values(api.paths).flatMap((path) =>
      Object.values(path).filter((value) => value?.operationId),
    );
    assert.equal(new Set(operations.map((op) => op.operationId)).size, operations.length);
    for (const operation of operations) {
      assert.ok(operation.responses, `${operation.operationId} must define responses`);
    }
  });
}

test('public API never exposes the scoring service boundary', async () => {
  const text = await readFile(contracts[0][1], 'utf8');
  assert.doesNotMatch(text, /\/internal\/v1\/scores/);
  assert.doesNotMatch(text, /SCORING_BASE_URL/);
});
