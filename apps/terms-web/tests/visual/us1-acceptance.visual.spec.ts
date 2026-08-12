import { expect, test } from '@playwright/test';
import { mockPendingTerms, termsVersion } from '../support/terms-fixtures';

test('@visual pending long-document geometry is stable', async ({ page }) => {
  await mockPendingTerms(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
  await expect(page).toHaveScreenshot(`us1-document-${test.info().project.name}.png`, { fullPage: true });
});

test('@visual loading reserves layout without overflow', async ({ page }) => {
  await mockPendingTerms(page, { delay: 5_000 });
  await page.goto('./');
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page).toHaveScreenshot(`us1-loading-${test.info().project.name}.png`, { fullPage: true });
});

test('@visual version-changed and unavailable states remain operable', async ({ page }) => {
  await mockPendingTerms(page, { changed: true });
  await page.goto('./');
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveScreenshot(`us1-changed-${test.info().project.name}.png`, { fullPage: true });
  await page.route('**/terms-api/v1/current', (route) => route.fulfill({ status: 503, json: {
    type: 'about:blank', title: 'Unavailable', status: 503, code: 'TERMS_SERVICE_UNAVAILABLE', retryable: true,
  } }));
  await page.getByRole('button', { name: 'Revisar nueva versión' }).click();
  await expect(page.getByRole('alert')).toContainText('No podemos verificar');
  expect(termsVersion.content.length).toBeGreaterThan(0);
});
