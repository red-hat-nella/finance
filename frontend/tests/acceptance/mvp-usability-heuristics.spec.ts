import { readFile } from 'node:fs/promises';
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { expectNoOverflow } from '../support/geometry';

interface CreatedEvaluation {
  evaluationId: string;
  documentNumber: string;
  completedDate: string;
}

interface AcceptanceMetric {
  criterion: 'SC-001' | 'SC-005' | 'SC-006';
  flow: string;
  durationMs: number;
  interactions: number;
  interactionLimit: number;
  durationLimitMs: number;
  checks?: number;
}

function bogotaCalendarDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function attachMetric(
  testInfo: TestInfo,
  metric: AcceptanceMetric,
): Promise<void> {
  await testInfo.attach(`${metric.criterion}-${metric.flow}.json`, {
    body: JSON.stringify(metric, null, 2),
    contentType: 'application/json',
  });
  console.log(`ACCEPTANCE_METRIC ${JSON.stringify(metric)}`);
}

async function createEvaluation(
  request: APIRequestContext,
  fixtureName: 'low-risk-application.json' | 'medium-risk-application.json',
): Promise<CreatedEvaluation> {
  const fixture = JSON.parse(
    await readFile(`../tests/fixtures/${fixtureName}`, 'utf8'),
  );
  const documentNumber = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
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
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
        'If-Match': created.headers()['etag'],
      },
    },
  );
  expect(evaluated.status()).toBe(201);
  const result = await evaluated.json();
  return {
    evaluationId: result.evaluationId,
    documentNumber,
    completedDate: bogotaCalendarDate(String(result.completedAt)),
  };
}

async function clearHistoryFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await expect(page.getByLabel('ID de evaluación')).toHaveValue('');
}

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(
    testInfo.project.name !== 'desktop-1024',
    'La aceptación MVP usa un viewport de escritorio estable; responsive tiene gate dedicado.',
  );
});

test('SC-001 completes the reference registration within time and interaction budgets', async ({
  page,
}, testInfo) => {
  await page.goto('/applications/new');
  const startedAt = performance.now();
  let interactions = 0;
  const fill = async (label: string, value: string) => {
    interactions += 1;
    await page.getByLabel(label).fill(value);
  };

  await fill('Número de documento', `${Date.now()}`.slice(-10));
  await fill('Nombre completo', 'Lucía Torres');
  await fill('Teléfono', '+573001234567');
  await fill('Ingreso mensual (COP)', '4000000');
  await fill('Estabilidad (meses)', '48');
  await fill('Promedio mensual (COP)', '250000');
  await fill('Pagos puntuales', '12');
  await fill('Antigüedad (meses)', '48');
  await fill('Meses regulares', '12');
  interactions += 1;
  await page.getByRole('checkbox', { name: /otorgó consentimiento/ }).check();
  interactions += 1;
  await page.getByRole('button', { name: 'Calcular score' }).click();

  await expect(page).toHaveURL(/\/evaluations\/[0-9a-f-]+$/i);
  await expect(page.getByText('835', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /reintentar/i })).toHaveCount(0);

  const metric: AcceptanceMetric = {
    criterion: 'SC-001',
    flow: 'register-and-evaluate',
    durationMs: Math.round(performance.now() - startedAt),
    interactions,
    interactionLimit: 12,
    durationLimitMs: 300_000,
  };
  expect(metric.interactions).toBeLessThanOrEqual(metric.interactionLimit);
  expect(metric.durationMs).toBeLessThan(metric.durationLimitMs);
  await attachMetric(testInfo, metric);
});

test('SC-005 finds the authorized evaluation with every supported filter', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const created = await createEvaluation(request, 'medium-risk-application.json');
  await page.goto('/evaluations');
  await expect(page.getByRole('heading', { name: 'Histórico de evaluaciones' })).toBeVisible();

  const runFilter = async (
    flow: string,
    expectedInteractions: number,
    configure: () => Promise<void>,
  ) => {
    await clearHistoryFilters(page);
    const startedAt = performance.now();
    const response = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'POST' &&
        candidate.url().endsWith('/api/v1/evaluations/search'),
    );
    await configure();
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    expect((await response).ok()).toBeTruthy();
    await expect(
      page.getByRole('link', { name: 'Abrir' }).first(),
    ).toHaveAttribute('href', `/evaluations/${created.evaluationId}/details`);
    const metric: AcceptanceMetric = {
      criterion: 'SC-005',
      flow,
      durationMs: Math.round(performance.now() - startedAt),
      interactions: expectedInteractions,
      interactionLimit: 5,
      durationLimitMs: 30_000,
    };
    expect(metric.interactions).toBeLessThanOrEqual(metric.interactionLimit);
    expect(metric.durationMs).toBeLessThan(metric.durationLimitMs);
    await attachMetric(testInfo, metric);
  };

  await runFilter('evaluation-id', 2, async () => {
    await page.getByLabel('ID de evaluación').fill(created.evaluationId);
  });
  await runFilter('applicant-identifier', 4, async () => {
    await page.getByLabel('Tipo de documento').click();
    await page.getByRole('option', { name: 'Cédula de extranjería' }).click();
    await page.getByLabel('Documento exacto').fill(created.documentNumber);
  });
  await runFilter('date-range', 3, async () => {
    await page.getByLabel('Desde').fill(created.completedDate);
    await page.getByLabel('Hasta').fill(created.completedDate);
  });
  await runFilter('state', 4, async () => {
    await page.getByLabel('Estado').click();
    await page.getByRole('option', { name: 'Revisión manual' }).click();
    await page.keyboard.press('Escape');
  });
});

test('SC-006 exposes a complete explainable result through semantic text', async ({
  page,
  request,
}, testInfo) => {
  const created = await createEvaluation(request, 'low-risk-application.json');
  const startedAt = performance.now();
  await page.goto(`/evaluations/${created.evaluationId}`);
  await expect(page.getByRole('heading', { name: 'Resultado de la evaluación' })).toBeVisible();

  const summary = page.locator('app-score-summary');
  await expect(summary.getByText('Score alternativo')).toBeVisible();
  await expect(summary.getByText('835', { exact: true })).toBeVisible();
  await expect(summary.getByText('/ 850', { exact: true })).toBeVisible();
  await expect(summary.locator('app-risk-badge').getByText('Riesgo bajo')).toBeVisible();
  await expect(
    summary.getByRole('heading', { name: 'Continuar con el análisis crediticio humano.' }),
  ).toBeVisible();
  await expect(summary.getByText(/no constituye una aprobación automática/i)).toBeVisible();

  const factors = page.locator('app-factor-list');
  await expect(
    factors.getByRole('heading', { name: 'Factores que explican el resultado' }),
  ).toBeVisible();
  const factorItems = factors.getByRole('listitem');
  await expect(factorItems).toHaveCount(3);
  for (const item of await factorItems.all()) {
    await expect(item.getByRole('heading', { level: 3 })).not.toHaveText('');
    await expect(item.locator('strong')).toContainText('puntos');
    await expect(item.locator('p')).not.toHaveText('');
  }
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('[mat-flat-button]')).toHaveCount(1);
  await expectNoOverflow(page);

  const metric: AcceptanceMetric = {
    criterion: 'SC-006',
    flow: 'semantic-explanation-checklist',
    durationMs: Math.round(performance.now() - startedAt),
    interactions: 0,
    interactionLimit: 0,
    durationLimitMs: 60_000,
    checks: 10,
  };
  expect(metric.durationMs).toBeLessThan(metric.durationLimitMs);
  await attachMetric(testInfo, metric);
});
