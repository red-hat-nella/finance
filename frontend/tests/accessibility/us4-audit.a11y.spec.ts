import { expect, test } from '@playwright/test';
import { auditResponse, retriedAuditId } from '../support/audit-responses';
import { expectVisibleFocus, expectWcagAA, useTwoHundredPercentZoom } from '../support/accessibility';
import { expectNoOverflow } from '../support/geometry';

test('audit timeline supports keyboard, zoom and WCAG AA', async ({ page }) => {
  await page.addInitScript(() =>
    window.sessionStorage.setItem('scoring.dev.role', 'auditor'),
  );
  await page.route(`**/api/v1/evaluations/${retriedAuditId}/audit`, (route) =>
    route.fulfill({ json: auditResponse(retriedAuditId, 'retry') }),
  );
  await page.goto(`/evaluations/${retriedAuditId}/audit`);
  await expect(
    page.getByRole('heading', { name: 'Trazabilidad de evaluación' }),
  ).toBeVisible();
  const summary = page.getByText('Ver metadatos operativos').first();
  await summary.focus();
  await expectVisibleFocus(summary);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Versión de criterios')).toBeVisible();
  await expectWcagAA(page);
  if (page.viewportSize()!.width >= 1024) await useTwoHundredPercentZoom(page);
  await expectNoOverflow(page);
});
