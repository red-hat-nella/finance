import { expect, test } from '@playwright/test';
import { mockAudit } from '../support/audit-fixtures';

for (const scenario of ['results', 'empty', 'unavailable'] as const) {
  test(`@visual audit ${scenario} is responsive`, async ({ page }) => {
    await mockAudit(page, scenario);
    await page.goto('./acceptances');
    await page.getByRole('button', { name: 'Buscar aceptaciones' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await expect(page).toHaveScreenshot(`us3-audit-${scenario}-${test.info().project.name}.png`, { fullPage: true });
  });
}
