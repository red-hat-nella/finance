import { expect, test, type Page } from '@playwright/test';
import {
  auditedEvaluationId,
  auditResponse,
  manualAuditId,
  retriedAuditId,
} from '../support/audit-responses';

async function useSupervisor(page: Page): Promise<void> {
  await page.addInitScript(() =>
    window.sessionStorage.setItem('scoring.dev.role', 'supervisor'),
  );
}

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(
    testInfo.project.name !== 'desktop-1024',
    'The functional audit journey runs once; responsive behavior has a dedicated suite.',
  );
});

test('supervisor reconstructs evaluated, manual and failed-retry timelines read-only', async ({
  page,
}) => {
  await useSupervisor(page);
  const fixtures = [
    { id: auditedEvaluationId, scenario: 'evaluated' as const, expected: 'Evaluación completada', state: 'evaluada' },
    { id: manualAuditId, scenario: 'manual' as const, expected: 'Evaluación completada', state: 'revision_manual' },
    { id: retriedAuditId, scenario: 'retry' as const, expected: 'Evaluación reintentada', state: 'error' },
  ];
  let requests = 0;
  for (const fixture of fixtures) {
    await page.route(`**/api/v1/evaluations/${fixture.id}/audit`, async (route) => {
      requests += 1;
      await route.fulfill({ json: auditResponse(fixture.id, fixture.scenario) });
    });
    await page.goto(`/evaluations/${fixture.id}/audit`);
    await expect(
      page.getByRole('heading', { name: 'Trazabilidad de evaluación' }),
    ).toBeVisible();
    await expect(page.getByText(fixture.expected, { exact: false })).toBeVisible();
    await page.getByText('Ver metadatos operativos').nth(1).click();
    await expect(page.getByText(fixture.state, { exact: true })).toBeVisible();
    await expect(page.getByText('Trazabilidad consultada')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nueva solicitud' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Editar|Evaluar|Reintentar/ })).toHaveCount(0);
  }
  expect(requests).toBe(3);
  await expect(page.locator('body')).not.toContainText('analyst-owner-secret');
});

test('analyst is redirected before the protected audit endpoint is called', async ({
  page,
}) => {
  let called = false;
  await page.route(`**/api/v1/evaluations/${auditedEvaluationId}/audit`, async (route) => {
    called = true;
    await route.fulfill({ json: auditResponse() });
  });
  await page.goto(`/evaluations/${auditedEvaluationId}/audit`);
  await expect(page).toHaveURL(/\/evaluations\?access=denied$/);
  expect(called).toBe(false);
});
