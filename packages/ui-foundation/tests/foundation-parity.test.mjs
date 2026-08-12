import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repoRoot = new URL('../../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8');
}

for (const name of ['_tokens.scss', '_typography.scss', '_a11y.scss', '_states.scss']) {
  test(`${name} remains byte-for-byte equal to the canonical frontend`, async () => {
    assert.equal(
      await source(`packages/ui-foundation/src/${name}`),
      await source(`frontend/src/styles/${name}`),
    );
  });
}

test('terms responsive geometry preserves canonical dimensions', async () => {
  const canonicalContainer = await source('frontend/src/app/layout/responsive-container.component.ts');
  const termsContainer = await source('apps/terms-web/src/app/layout/responsive-container.component.ts');
  const canonicalShell = await source('frontend/src/app/layout/app-shell.component.ts');
  const termsShell = await source('apps/terms-web/src/app/layout/terms-shell.component.ts');

  for (const dimension of ['1200px', '959px', '599px', '32px', '24px', '16px']) {
    assert.match(canonicalContainer, new RegExp(dimension));
    assert.match(termsContainer, new RegExp(dimension));
  }
  for (const dimension of ['100dvh', '40px', '24px', '64px']) {
    assert.match(canonicalShell, new RegExp(dimension));
    assert.match(termsShell, new RegExp(dimension));
  }
});
