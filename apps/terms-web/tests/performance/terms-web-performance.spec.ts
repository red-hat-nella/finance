import { expect, test } from '@playwright/test';
import { mockPendingTerms } from '../support/terms-fixtures';

test('healthy gate is interactive within 1500 ms and remains visually stable', async ({ page }) => {
  await mockPendingTerms(page);
  await page.addInitScript(() => {
    (window as Window & { __layoutShifts?: number[] }).__layoutShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as Window & { __layoutShifts?: number[] }).__layoutShifts?.push(shift.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const started = Date.now();
  await page.goto('./');
  const button = page.getByRole('button', { name: 'Aceptar y continuar' });
  await expect(button).toBeEnabled();
  expect(Date.now() - started).toBeLessThan(1_500);
  await page.waitForTimeout(100);
  const cls = await page.evaluate(() => (window as Window & { __layoutShifts?: number[] }).__layoutShifts?.reduce((sum, value) => sum + value, 0) ?? 0);
  expect(cls).toBeLessThan(0.1);
});
