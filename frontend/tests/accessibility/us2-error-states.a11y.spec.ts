import { expect, test } from '@playwright/test';
import { expectWcagAA, useReducedMotion } from '../support/accessibility';
import { expectNoOverflow } from '../support/geometry';
import { errorEvaluation, evaluationId, manualWithoutScore } from '../support/recovery-responses';

for (const state of [errorEvaluation(), manualWithoutScore()]) {
  test(`US2 ${state.state} meets WCAG AA and keyboard requirements`, async ({ page }) => {
    await useReducedMotion(page);
    await page.route(`**/api/v1/evaluations/${evaluationId}`, (route) => route.fulfill({ json: state }));
    await page.goto(`/evaluations/${evaluationId}`);
    await expect(
      state.state === 'error'
        ? page.getByRole('heading', { name: 'No fue posible calcular el score' })
        : page.getByText('Sin score concluyente'),
    ).toBeVisible();
    await expectWcagAA(page);
    await expectNoOverflow(page);
    if (state.state === 'error') {
      const retry = page.getByRole('button', { name: 'Reintentar evaluación' });
      await retry.focus();
      await expect(retry).toBeFocused();
    }
  });
}
