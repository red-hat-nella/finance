import { expect, test } from '@playwright/test';
import { mockPendingTerms, termsVersion } from '../support/terms-fixtures';

test('direct navigation shows the exact current document and accepts once', async ({ page }) => {
  await mockPendingTerms(page);
  let posts = 0;
  page.on('request', (request) => { if (request.url().endsWith('/v1/acceptances')) posts += 1; });
  await page.goto('./?returnUrl=%2Fapplications%2Fnew');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(termsVersion.title);
  await page.getByRole('button', { name: 'Aceptar y continuar' }).dblclick();
  await expect(page.getByRole('status')).toContainText('Términos aceptados');
  expect(posts).toBe(1);
});

test('rejects external returnUrl and supports exit without acceptance', async ({ page }) => {
  await mockPendingTerms(page);
  await page.goto('./?returnUrl=https%3A%2F%2Fevil.example');
  await page.getByRole('button', { name: 'Salir' }).first().click();
  await expect(page).not.toHaveURL(/evil\.example/);
});

test('version change requires reviewing the replacement document', async ({ page }) => {
  await mockPendingTerms(page, { changed: true });
  await page.goto('./');
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await expect(page.getByRole('alert')).toContainText('Los términos cambiaron');
  await page.getByRole('button', { name: 'Revisar nueva versión' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('later accepted session does not flash the document', async ({ page }) => {
  await page.route('**/terms-api/v1/current', (route) => route.fulfill({ json: {
    version: termsVersion, acceptanceStatus: 'ACCEPTED', acceptedAt: '2026-08-12T12:00:00.000Z',
  } }));
  await page.goto('./?returnUrl=%2Fevaluations');
  await expect(page.locator('article')).toHaveCount(0);
});
