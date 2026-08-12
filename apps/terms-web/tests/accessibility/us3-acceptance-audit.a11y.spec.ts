import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAudit } from '../support/audit-fixtures';

test('audit filters and results meet WCAG 2.2 AA', async ({ page }) => {
  await mockAudit(page); await page.goto('./acceptances');
  await page.getByRole('button', { name: 'Buscar aceptaciones' }).click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});
