import { expect, test } from '@playwright/test';
import {
  expectVisibleFocus,
  expectWcagAA,
  useReducedMotion,
} from '../support/accessibility';
import { expectNoOverflow } from '../support/geometry';
import {
  evaluationProfiles,
  evaluationResponse,
} from '../support/evaluation-profiles';

test('form supports keyboard, visible focus, reduced motion and WCAG AA', async ({ page }) => {
  await useReducedMotion(page);
  await page.goto('/applications/new');
  await expectWcagAA(page);

  const document = page.getByLabel('Número de documento');
  await document.focus();
  await expect(document).toBeFocused();
  await expectVisibleFocus(document);
  await page.keyboard.type('102341032');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Nombre completo')).toBeFocused();
  await expectNoOverflow(page);
});

for (const profile of evaluationProfiles) {
  test(`result ${profile.name} meets WCAG AA and keyboard requirements`, async ({ page }) => {
    await useReducedMotion(page);
    await page.route('**/api/v1/evaluations/*', (route) =>
      route.fulfill({ json: evaluationResponse(profile) }),
    );
    await page.goto('/evaluations/20000000-0000-4000-8000-000000000001');
    await expect(page.getByText(profile.score.toString(), { exact: true })).toBeVisible();
    await expectWcagAA(page);
    await expectNoOverflow(page);

    const copy = page.getByRole('button', { name: 'Copiar identificador' });
    await copy.focus();
    await expectVisibleFocus(copy);
  });
}
