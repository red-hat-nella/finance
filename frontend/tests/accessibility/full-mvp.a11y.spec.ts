import { expect, test } from '@playwright/test';
import { auditResponse, retriedAuditId } from '../support/audit-responses';
import { expectVisibleFocus, expectWcagAA, useReducedMotion, useTwoHundredPercentZoom } from '../support/accessibility';
import { expectNoOverflow, expectTouchTargets } from '../support/geometry';
import { errorEvaluation, evaluationId, manualWithoutScore } from '../support/recovery-responses';

test.beforeEach(async ({ page }) => useReducedMotion(page));

test('form and invalid summary support keyboard, focus, AA and 200% reflow', async ({ page }) => {
  await page.goto('/applications/new');
  await expectWcagAA(page);
  await page.getByRole('button', { name: 'Calcular score' }).click();
  await expect(page.getByLabel('Número de documento')).toBeFocused();
  await expectVisibleFocus(page.getByLabel('Número de documento'));
  if (page.viewportSize()!.width >= 1024) await useTwoHundredPercentZoom(page);
  await expectNoOverflow(page);
  await expectWcagAA(page);
});

for (const state of [manualWithoutScore(), errorEvaluation()]) {
  test(`result state ${state.state} remains accessible`, async ({ page }) => {
    await page.route(`**/api/v1/evaluations/${evaluationId}`, (route) => route.fulfill({ json: state }));
    await page.goto(`/evaluations/${evaluationId}`);
    await expectWcagAA(page);
    await expectNoOverflow(page);
    await expectTouchTargets(page.locator('button:visible,a:visible'));
  });
}

test('audit timeline exposes focus and semantic expansion without sensitive text', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('scoring.dev.role', 'auditor'));
  await page.route(`**/api/v1/evaluations/${retriedAuditId}/audit`, (route) =>
    route.fulfill({ json: auditResponse(retriedAuditId, 'retry') }),
  );
  await page.goto(`/evaluations/${retriedAuditId}/audit`);
  const details = page.getByText('Ver metadatos operativos').first();
  await expectVisibleFocus(details);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Versión de criterios')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('analyst-owner-secret');
  await expectWcagAA(page);
  await expectNoOverflow(page);
});
