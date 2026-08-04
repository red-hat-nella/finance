import { readFile } from 'node:fs/promises';
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

interface CreatedEvaluation {
  evaluationId: string;
  documentNumber: string;
}

async function createEvaluation(
  request: APIRequestContext,
): Promise<CreatedEvaluation> {
  const fixture = JSON.parse(
    await readFile('../tests/fixtures/medium-risk-application.json', 'utf8'),
  );
  const documentNumber = `81${Date.now().toString().slice(-7)}`;
  fixture.applicant.documentNumber = documentNumber;
  const created = await request.post('/api/v1/applications', {
    data: fixture,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(created.status()).toBe(201);
  const application = await created.json();
  const evaluated = await request.post(
    `/api/v1/applications/${application.applicationId}/evaluations`,
    {
      data: {
        revisionNumber: 1,
        expectedCriteriaVersion: 'SCORING-MVP-1.0.0',
      },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    },
  );
  expect(evaluated.status()).toBe(201);
  const result = await evaluated.json();
  return { evaluationId: result.evaluationId, documentNumber };
}

async function applyFilters(page: Page): Promise<Record<string, unknown>> {
  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().endsWith('/api/v1/evaluations/search'),
  );
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  return (await requestPromise).postDataJSON() as Record<string, unknown>;
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1024',
    'The functional journey runs once; responsive behavior has a dedicated suite.',
  );
});

test('filters history, clears state and opens the authorized detail', async ({
  page,
  request,
}) => {
  const created = await createEvaluation(request);
  await page.goto('/evaluations');
  await expect(
    page.getByRole('heading', { name: 'Histórico de evaluaciones' }),
  ).toBeVisible();

  const rows = page.getByRole('row');
  await expect(
    rows.nth(1).getByRole('link', { name: 'Abrir' }),
  ).toHaveAttribute('href', `/evaluations/${created.evaluationId}/details`);

  await page.getByLabel('ID de evaluación').fill(created.evaluationId);
  let body = await applyFilters(page);
  expect(body).toMatchObject({ page: 1, evaluationId: created.evaluationId });
  await expect(page.getByText('Carlos M.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await page.getByLabel('Tipo de documento').click();
  await page.getByRole('option', { name: 'Cédula de extranjería' }).click();
  await page.getByLabel('Documento exacto').fill(created.documentNumber);
  body = await applyFilters(page);
  expect(body).toMatchObject({
    applicantIdentifier: {
      documentType: 'CE',
      documentNumber: created.documentNumber,
    },
  });
  expect(page.url()).not.toContain(created.documentNumber);

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await page.getByLabel('Desde').fill('2026-08-04');
  await page.getByLabel('Hasta').fill('2026-08-04');
  body = await applyFilters(page);
  expect(body).toMatchObject({
    dateFrom: '2026-08-04',
    dateTo: '2026-08-04',
  });

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await page.getByLabel('Estado').click();
  await page.getByRole('option', { name: 'Revisión manual' }).click();
  await page.keyboard.press('Escape');
  body = await applyFilters(page);
  expect(body).toMatchObject({ states: ['revision_manual'] });

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(page.getByLabel('ID de evaluación')).toHaveValue('');
  await expect(page.getByLabel('Documento exacto')).toHaveValue('');
  await expect(page.getByLabel('Desde')).toHaveValue('');
  await expect(page.getByLabel('Hasta')).toHaveValue('');

  await page.getByLabel('ID de evaluación').fill(created.evaluationId);
  await applyFilters(page);
  await page.getByRole('link', { name: 'Abrir' }).first().click();
  await expect(page).toHaveURL(`/evaluations/${created.evaluationId}/details`);
  await expect(page.getByText(created.documentNumber)).toBeVisible();
  await page.getByRole('button', { name: 'Volver al histórico' }).click();
  await expect(page).toHaveURL('/evaluations');
  await expect(page.getByLabel('ID de evaluación')).toHaveValue(
    created.evaluationId,
  );
});

test('distinguishes empty states and recovers from a history error', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/v1/evaluations/search', async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          page: 1,
          pageSize: 25,
          totalItems: 0,
          totalPages: 0,
        }),
      });
      return;
    }
    if (calls === 2) {
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ code: 'INTERNAL_FAILURE' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
      }),
    });
  });

  await page.goto('/evaluations');
  await expect(page.getByText('Aún no hay evaluaciones')).toBeVisible();
  await page.getByLabel('ID de evaluación').fill(crypto.randomUUID());
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(
    page.getByText(
      'No fue posible completar la operación. Intente nuevamente.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Intentar nuevamente' }).click();
  await expect(
    page.getByText('No encontramos evaluaciones con estos filtros'),
  ).toBeVisible();
  await expect(page.getByLabel('ID de evaluación')).not.toHaveValue('');
});

test('uses a non-enumerating error for an inaccessible evaluation', async ({
  page,
}) => {
  await page.goto(`/evaluations/${crypto.randomUUID()}/details`);
  await expect(
    page.getByText(
      'No encontramos una evaluación accesible con ese identificador.',
    ),
  ).toBeVisible();
  await expect(page.getByText(/organización|propietario/i)).toHaveCount(0);
});
