import { expect, test } from '@playwright/test';
import { auditResponse, retriedAuditId } from '../support/audit-responses';
import { capturePage, expectCentered, expectNoOverflow } from '../support/geometry';
import { evaluationProfiles, evaluationResponse } from '../support/evaluation-profiles';

test('@visual supervisor audit remains centered and readable at every viewport', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    window.sessionStorage.setItem('scoring.dev.role', 'supervisor'),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`**/api/v1/evaluations/${retriedAuditId}/audit`, (route) =>
    route.fulfill({ json: auditResponse(retriedAuditId, 'retry') }),
  );
  await page.route(new RegExp(`/api/v1/evaluations/${retriedAuditId}$`), (route) =>
    route.fulfill({
      json: {
        ...evaluationResponse(evaluationProfiles[0]!),
        evaluationId: retriedAuditId,
        inputSnapshot: null,
      },
    }),
  );
  await page.goto(`/evaluations/${retriedAuditId}/details`);
  await expect(
    page.getByRole('heading', { name: 'Detalle de evaluación' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nueva solicitud' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ver trazabilidad' })).toBeVisible();
  await expectNoOverflow(page);
  await capturePage(page, testInfo, 'us4-supervisor-detail');
  await page.getByRole('link', { name: 'Ver trazabilidad' }).click();
  await expect(
    page.getByRole('heading', { name: 'Trazabilidad de evaluación' }),
  ).toBeVisible();
  await page.getByText('Ver metadatos operativos').first().click();
  await expectCentered(page.locator('main app-responsive-container'), page);
  await expectNoOverflow(page);
  await capturePage(page, testInfo, 'us4-supervisor-audit');
});
