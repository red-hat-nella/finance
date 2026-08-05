import { expect, test, type Page } from '@playwright/test';
import {
  applicationId,
  errorEvaluation,
  evaluationId,
  manualWithoutScore,
  successfulRetry,
} from '../support/recovery-responses';

async function fillIdentity(page: Page): Promise<void> {
  await page.getByLabel('Número de documento').fill('102341032');
  await page.getByLabel('Nombre completo').fill('María Paula Rojas');
  await page.getByLabel('Teléfono').fill('+573001112233');
}

async function markUnavailable(page: Page): Promise<void> {
  for (const [checkbox, reason] of [
    ['No se dispone de información de ingresos', 'El solicitante no entregó soportes de ingresos.'],
    ['No se dispone de referencias de servicios públicos', 'No existen referencias verificables para el período.'],
    ['No se dispone de información de telefonía móvil', 'La línea móvil fue activada recientemente sin histórico.'],
  ] as const) {
    await page.getByRole('checkbox', { name: checkbox }).check();
    await page.getByLabel('Motivo de no disponibilidad').last().fill(reason);
  }
}

function applicationResponse() {
  return {
    applicationId,
    state: 'borrador',
    revisionNumber: 1,
    lockVersion: 1,
    createdAt: '2026-08-04T12:00:00Z',
    updatedAt: '2026-08-04T12:00:00Z',
    draftExpiresAt: '2026-11-02T12:00:00Z',
    applicant: {
      documentType: 'CC',
      documentNumber: '102341032',
      fullName: 'María Paula Rojas',
      contact: { phone: '+573001112233' },
      documentMasked: 'CC ••••••1032',
      displayName: 'María P.',
    },
  };
}

test('invalid and missing consent block evaluation with actionable focus', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => {
    if (/\/evaluations$/.test(request.url())) requests += 1;
  });
  await page.goto('/applications/new');
  await page.getByRole('button', { name: 'Calcular score' }).click();
  await expect(page.getByRole('alert', { name: 'Revise la información' })).toContainText('Complete los campos obligatorios');
  await expect(page.getByLabel('Número de documento')).toBeFocused();
  await fillIdentity(page);
  await markUnavailable(page);
  await page.getByRole('button', { name: 'Calcular score' }).click();
  await expect(page.getByRole('alert', { name: 'Revise la información' })).toContainText('Consentimiento');
  expect(requests).toBe(0);
});

test('incomplete but declared data produces manual review without a fabricated score', async ({ page }) => {
  await page.route('**/api/v1/applications', (route) =>
    route.fulfill({ status: 201, headers: { etag: '"1"' }, json: applicationResponse() }),
  );
  await page.route(`**/api/v1/applications/${applicationId}/evaluations`, (route) =>
    route.fulfill({ status: 201, json: manualWithoutScore() }),
  );
  await page.goto('/applications/new');
  await fillIdentity(page);
  await markUnavailable(page);
  await page.getByRole('checkbox', { name: /otorgó consentimiento/ }).check();
  await page.getByRole('button', { name: 'Calcular score' }).click();
  await expect(page.getByText('Sin score concluyente')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revisión manual obligatoria' })).toBeVisible();
  await expect(page.locator('.score')).toHaveCount(0);
});

test('operational failure can be retried once and preserves the previous attempt link', async ({ page }) => {
  let retries = 0;
  await page.route(`**/api/v1/evaluations/${evaluationId}/retry`, async (route) => {
    retries += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ status: 201, json: successfulRetry() });
  });
  await page.route(`**/api/v1/evaluations/${evaluationId}`, (route) =>
    route.fulfill({ json: errorEvaluation() }),
  );
  await page.goto(`/evaluations/${evaluationId}`);
  const retry = page.getByRole('button', { name: 'Reintentar evaluación' });
  await retry.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText('835', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Intentos relacionados' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Intento 1 · Error/ })).toBeVisible();
  expect(retries).toBe(1);
});
