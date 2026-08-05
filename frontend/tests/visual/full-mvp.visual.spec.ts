import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { expectWcagAA } from '../support/accessibility';
import { expectNoOverflow } from '../support/geometry';

async function stabilizeLayout(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    (window as unknown as { __layoutShift: number }).__layoutShift = 0;
  });
  await page.waitForTimeout(100);
}

test('@visual form, result, history and detail remain accessible without overlap', async ({
  page,
  request,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    (window as unknown as { __layoutShift: number }).__layoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
        if (!entry.hadRecentInput)
          (window as unknown as { __layoutShift: number }).__layoutShift += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/applications/new');
  await expect(
    page.getByRole('heading', { name: 'Nueva evaluación' }),
  ).toBeVisible();
  await stabilizeLayout(page);
  await expectNoOverflow(page);
  await expectWcagAA(page);
  await page.screenshot({
    path: testInfo.outputPath('form.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => (window as unknown as { __layoutShift: number }).__layoutShift)).toBeLessThan(0.1);

  const fixture = JSON.parse(
    await readFile('../tests/fixtures/medium-risk-application.json', 'utf8'),
  );
  fixture.applicant.documentNumber = `74${Date.now().toString().slice(-6)}`;
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
  expect(result.score).toBe(634);
  expect(result.factors).toHaveLength(3);

  await page.goto(`/evaluations/${result.evaluationId}`);
  await expect(page.getByText('634', { exact: true })).toBeVisible();
  await expect(page.locator('app-risk-badge')).toContainText('Riesgo medio');
  await stabilizeLayout(page);
  await expectNoOverflow(page);
  await expectWcagAA(page);
  await page.screenshot({
    path: testInfo.outputPath('result.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => (window as unknown as { __layoutShift: number }).__layoutShift)).toBeLessThan(0.1);

  await page.goto('/evaluations');
  await expect(
    page
      .locator('app-history-table:visible, app-history-list:visible')
      .getByText('Carlos M.')
      .first(),
  ).toBeVisible();
  await stabilizeLayout(page);
  await expectNoOverflow(page);
  await expectWcagAA(page);
  await page.screenshot({
    path: testInfo.outputPath('history.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => (window as unknown as { __layoutShift: number }).__layoutShift)).toBeLessThan(0.1);

  await page.goto(`/evaluations/${result.evaluationId}/details`);
  await expect(
    page.getByRole('heading', { name: 'Detalle de evaluación' }),
  ).toBeVisible();
  await expect(page.getByText('Datos evaluados del solicitante')).toBeVisible();
  await expect(page.getByText(fixture.applicant.documentNumber)).toBeVisible();
  await expect(page.getByText('SCORING-MVP-1.0.0')).toBeVisible();
  await stabilizeLayout(page);
  await expectNoOverflow(page);
  await expectWcagAA(page);
  await page.screenshot({
    path: testInfo.outputPath('detail.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => (window as unknown as { __layoutShift: number }).__layoutShift)).toBeLessThan(0.1);
});
