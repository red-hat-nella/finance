import { expect, test, type Page } from '@playwright/test';
import { auditResponse } from '../support/audit-responses';
import { errorEvaluation, evaluationId, successfulRetry } from '../support/recovery-responses';

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'desktop-1024', 'La regresión cross-story se ejecuta una vez.');
});

async function fillLowRiskApplication(page: Page): Promise<void> {
  await page.getByLabel('Número de documento').fill(`${Date.now()}`.slice(-10));
  await page.getByLabel('Nombre completo').fill('Lucía Torres');
  await page.getByLabel('Teléfono').fill('+573001234567');
  await page.getByLabel('Ingreso mensual (COP)').fill('4000000');
  await page.getByLabel('Estabilidad (meses)').fill('48');
  await page.getByLabel('Promedio mensual (COP)').fill('250000');
  await page.getByLabel('Pagos puntuales').fill('12');
  await page.getByLabel('Antigüedad (meses)').fill('48');
  await page.getByLabel('Meses regulares').fill('12');
  await page.getByRole('checkbox', { name: /otorgó consentimiento/ }).check();
}

test('create, evaluate, result, history, detail, audit, failure/retry and role switch', async ({ page }) => {
  await page.goto('/applications/new');
  await fillLowRiskApplication(page);
  await page.getByRole('button', { name: 'Calcular score' }).click();
  await expect(page).toHaveURL(/\/evaluations\/[0-9a-f-]+$/i);
  await expect(page.getByText('835', { exact: true })).toBeVisible();
  const createdEvaluationId = page.url().split('/').at(-1)!;

  await page.goto('/evaluations');
  await expect(page.getByText('Lucía T.').first()).toBeVisible();
  await page.goto(`/evaluations/${createdEvaluationId}/details`);
  await expect(page.getByText('Datos evaluados del solicitante')).toBeVisible();
  await expect(page.getByText('SCORING-MVP-1.0.0')).toBeVisible();

  await page.route(`**/api/v1/evaluations/${createdEvaluationId}/audit`, (route) =>
    route.fulfill({ json: auditResponse(createdEvaluationId) }),
  );
  await page.evaluate(() => sessionStorage.setItem('scoring.dev.role', 'supervisor'));
  await page.goto(`/evaluations/${createdEvaluationId}/audit`);
  await expect(page.getByRole('heading', { name: 'Trazabilidad de evaluación' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nueva solicitud' })).toHaveCount(0);

  await page.route(`**/api/v1/evaluations/${evaluationId}`, (route) =>
    route.fulfill({ json: errorEvaluation() }),
  );
  await page.route(`**/api/v1/evaluations/${evaluationId}/retry`, (route) =>
    route.fulfill({ status: 201, json: successfulRetry() }),
  );
  await page.evaluate(() => sessionStorage.setItem('scoring.dev.role', 'credit_analyst'));
  await page.goto(`/evaluations/${evaluationId}`);
  await page.getByRole('button', { name: 'Reintentar evaluación' }).click();
  await expect(page.getByText('835', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Intento 1 · Error/ })).toBeVisible();
});
