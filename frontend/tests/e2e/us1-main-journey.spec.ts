import { expect, test, type Page } from '@playwright/test';

interface UiProfile {
  readonly name: string;
  readonly score: number;
  readonly band: string;
  readonly income: string;
  readonly stability: string;
  readonly utilityAmount: string;
  readonly onTime: string;
  readonly tenure: string;
  readonly regular: string;
}

const profiles: readonly UiProfile[] = [
  {
    name: 'riesgo bajo',
    score: 835,
    band: 'Riesgo bajo',
    income: '4000000',
    stability: '48',
    utilityAmount: '250000',
    onTime: '12',
    tenure: '48',
    regular: '12',
  },
  {
    name: 'riesgo alto',
    score: 385,
    band: 'Riesgo alto',
    income: '1200000',
    stability: '3',
    utilityAmount: '600000',
    onTime: '5',
    tenure: '4',
    regular: '4',
  },
];

async function fillApplication(page: Page, profile: UiProfile) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  await page.getByLabel('Número de documento').fill(suffix);
  await page.getByLabel('Nombre completo').fill(`Solicitante ${profile.name}`);
  await page.getByLabel('Teléfono').fill('+573001234567');
  await page.getByLabel('Ingreso mensual (COP)').fill(profile.income);
  await page.getByLabel('Estabilidad (meses)').fill(profile.stability);
  await page.getByLabel('Promedio mensual (COP)').fill(profile.utilityAmount);
  await page.getByLabel('Pagos puntuales').fill(profile.onTime);
  await page.getByLabel('Antigüedad (meses)').fill(profile.tenure);
  await page.getByLabel('Meses regulares').fill(profile.regular);
  await page
    .getByRole('checkbox', { name: /otorgó consentimiento/ })
    .check();
}

for (const profile of profiles) {
  test(`registro, guardado y resultado para ${profile.name}`, async ({ page }) => {
    await page.goto('/applications/new');
    await fillApplication(page, profile);

    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Borrador guardado')).toBeVisible();

    let evaluationRequests = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/applications\/[^/]+\/evaluations$/.test(request.url())
      )
        evaluationRequests += 1;
    });
    const calculate = page.getByRole('button', { name: 'Calcular score' });
    await calculate.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect(page).toHaveURL(/\/evaluations\/[0-9a-f-]+$/i);
    await expect(
      page.getByRole('heading', { name: 'Resultado de la evaluación' }),
    ).toBeVisible();
    await expect(
      page.getByText(profile.score.toString(), { exact: true }),
    ).toBeVisible();
    await expect(page.locator('app-risk-badge')).toContainText(profile.band);
    await expect(page.locator('.factors li')).toHaveCount(3);
    await expect(page.getByText('SCORING-MVP-1.0.0')).toBeVisible();
    await expect(page.getByText(/no constituye una aprobación automática/)).toBeVisible();
    expect(evaluationRequests).toBe(1);
  });
}
