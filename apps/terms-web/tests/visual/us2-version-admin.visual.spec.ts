import { expect, test } from '@playwright/test';
import { mockAdminApi } from '../support/admin-fixtures';

test('@visual version list changes table to cards without overflow', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto('./versions');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await expect(page).toHaveScreenshot(`us2-list-${test.info().project.name}.png`, { fullPage: true });
});

test('@visual editor preview and confirmation remain stable', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto('./versions/new');
  await page.getByLabel('Identificador de versión').fill('TERMS-2026-02');
  await page.getByLabel('Título').fill('Actualización 2026');
  await page.getByLabel('Contenido Markdown').fill('# Alcance\n\nContenido sintético');
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect(page).toHaveScreenshot(`us2-preview-${test.info().project.name}.png`, { fullPage: true });
});
