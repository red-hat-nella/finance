import { expect, test, type Page, type Route } from '@playwright/test';
import { expectCentered, expectNoOverflow } from '../support/geometry';
import {
  evaluationProfiles,
  evaluationResponse,
} from '../support/evaluation-profiles';

const applicationId = '10000000-0000-4000-8000-000000000001';

async function fillIdentity(page: Page) {
  await page.getByLabel('Número de documento').fill('102341032');
  await page.getByLabel('Nombre completo').fill('María Paula Rojas');
  await page.getByLabel('Teléfono').fill('+573001112233');
}

async function fillComplete(page: Page) {
  await fillIdentity(page);
  await page.getByLabel('Ingreso mensual (COP)').fill('4000000');
  await page.getByLabel('Estabilidad (meses)').fill('48');
  await page.getByLabel('Promedio mensual (COP)').fill('250000');
  await page.getByLabel('Pagos puntuales').fill('12');
  await page.getByLabel('Antigüedad (meses)').fill('48');
  await page.getByLabel('Meses regulares').fill('12');
  await page.getByRole('checkbox', { name: /otorgó consentimiento/ }).check();
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

async function fulfillApplication(route: Route) {
  await route.fulfill({
    status: 201,
    headers: { 'content-type': 'application/json', etag: '"1"' },
    body: JSON.stringify(applicationResponse()),
  });
}

test('form states remain stable without clipping or overlap', async ({ page }, testInfo) => {
  await page.goto('/applications/new');
  await expectCentered(page.locator('.form-page'), page);
  const step = page.locator('app-identity-section');
  const stepBox = await step.boundingBox();
  const legendBox = await step.locator('legend').boundingBox();
  expect(stepBox).not.toBeNull();
  expect(legendBox).not.toBeNull();
  expect(legendBox!.y - stepBox!.y).toBeGreaterThanOrEqual(23);
  expect(legendBox!.x - stepBox!.x).toBeGreaterThanOrEqual(15);
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('form-empty.png'), fullPage: true });

  await fillIdentity(page);
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('form-partial.png'), fullPage: true });

  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
  await page.route('**/api/v1/applications', async (route) => {
    await saveGate;
    await fulfillApplication(route);
  });
  const saving = page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Guardando…')).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('form-saving.png'), fullPage: true });
  releaseSave();
  await saving;
  await expect(page.getByText('Borrador guardado')).toBeVisible();

  await fillComplete(page);
  await page.route(`**/api/v1/applications/${applicationId}`, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', etag: '"2"' },
      body: JSON.stringify({
        ...applicationResponse(),
        lockVersion: 2,
        consent: {
          decision: 'accepted',
          noticeVersion: 'CONSENT-MVP-1.0.0',
          purposeCode: 'ALTERNATIVE_CREDIT_RISK_EVALUATION',
          recordedAt: '2026-08-04T12:00:01Z',
        },
      }),
    }),
  );
  let releaseEvaluation!: () => void;
  const evaluationGate = new Promise<void>((resolve) => (releaseEvaluation = resolve));
  await page.route(`**/api/v1/applications/${applicationId}/evaluations`, async (route) => {
    await evaluationGate;
    await route.fulfill({ json: evaluationResponse(evaluationProfiles[0]!) });
  });
  const evaluating = page.getByRole('button', { name: 'Calcular score' }).click();
  await expect(page.getByText('Evaluando…')).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('form-evaluating.png'), fullPage: true });
  releaseEvaluation();
  await evaluating;
});

for (const profile of evaluationProfiles) {
  test(`result ${profile.name} remains stable and explainable`, async ({ page }, testInfo) => {
    await page.route('**/api/v1/evaluations/*', (route) =>
      route.fulfill({ json: evaluationResponse(profile) }),
    );
    await page.goto('/evaluations/20000000-0000-4000-8000-000000000001');
    await expect(page.getByText(profile.score.toString(), { exact: true })).toBeVisible();
    await expect(page.locator('.factors li')).toHaveCount(3);
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`result-${profile.name}.png`), fullPage: true });
  });
}
