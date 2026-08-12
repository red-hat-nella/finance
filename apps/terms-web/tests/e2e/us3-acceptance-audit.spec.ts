import { expect, test } from '@playwright/test';
import { mockAudit } from '../support/audit-fixtures';

test('validates filters and returns masked read-only evidence', async ({ page }) => {
  await mockAudit(page);
  await page.goto('./acceptances');
  await page.getByLabel('Desde').fill('2026-08-13'); await page.getByLabel('Hasta').fill('2026-08-12');
  await page.getByRole('button', { name: 'Buscar aceptaciones' }).click();
  await expect(page.getByRole('alert')).toContainText('rango de fechas');
  await page.getByLabel('Desde').fill('2026-08-01'); await page.getByRole('button', { name: 'Buscar aceptaciones' }).click();
  await expect(page.locator('.results').getByText('act***001').filter({ visible: true }).first()).toBeVisible();
});

for (const scenario of ['empty', 'denied', 'unavailable'] as const) {
  test(`renders ${scenario} state and recovery`, async ({ page }) => {
    await mockAudit(page, scenario);
    await page.goto('./acceptances');
    await page.getByRole('button', { name: 'Buscar aceptaciones' }).click();
    await expect(page.locator('main')).toContainText(scenario === 'empty' ? 'No encontramos' : scenario === 'denied' ? 'No tienes permiso' : 'Intentar nuevamente');
  });
}
