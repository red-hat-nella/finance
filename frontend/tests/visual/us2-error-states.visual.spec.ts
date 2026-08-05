import { expect, test } from '@playwright/test';
import { expectNoOverflow } from '../support/geometry';
import {
  errorEvaluation,
  evaluationId,
  manualWithoutScore,
} from '../support/recovery-responses';

for (const state of [
  { name: 'manual-without-score', response: manualWithoutScore() },
  { name: 'timeout-error', response: errorEvaluation() },
] as const) {
  test(`@visual US2 ${state.name} has stable responsive geometry`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(`**/api/v1/evaluations/${evaluationId}`, (route) =>
      route.fulfill({ json: state.response }),
    );
    await page.goto(`/evaluations/${evaluationId}`);
    await expect(page.getByRole('heading', { name: 'Resultado de la evaluación' })).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`us2-${state.name}.png`), fullPage: true });
  });
}

test('@visual US2 invalid form and long messages do not overlap at zoom', async ({ page }, testInfo) => {
  await page.goto('/applications/new');
  await page.getByRole('button', { name: 'Calcular score' }).click();
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await expect(page.getByRole('alert', { name: 'Revise la información' })).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('us2-invalid-zoom.png'), fullPage: true });
});
