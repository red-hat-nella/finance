import { expect, test } from '@playwright/test';
import { draftVersion, mockAdminApi } from '../support/admin-fixtures';

test('lists versions and creates a validated draft with inert preview', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto('./versions');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Versiones');
  await page.getByRole('link', { name: 'Crear versión' }).click();
  await page.getByLabel('Identificador de versión').fill('invalid code');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('alert')).toContainText('Revisa los campos');
  await page.getByLabel('Identificador de versión').fill('TERMS-2026-02');
  await page.getByLabel('Título').fill('Actualización 2026');
  await page.getByLabel('Contenido Markdown').fill('# Seguro\n\n<script>alert(1)</script>');
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect(page.locator('.preview script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
});

test('requires confirmation before scheduling and supports withdrawal', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto(`./versions/${draftVersion.versionId}`);
  await page.getByLabel('Fecha de vigencia').fill('2026-09-01T07:00');
  await page.getByRole('button', { name: 'Programar publicación' }).click();
  await expect(page.getByRole('dialog')).toContainText('inmutable');
  await page.getByRole('button', { name: 'Confirmar publicación' }).click();
  await expect(page.getByText('SCHEDULED')).toBeVisible();
  await page.getByRole('button', { name: 'Retirar versión' }).click();
  await page.getByRole('button', { name: 'Confirmar retiro' }).click();
  await expect(page.getByText('WITHDRAWN')).toBeVisible();
});

test('shows actionable publication conflicts', async ({ page }) => {
  await mockAdminApi(page);
  await page.route('**/schedule', (route) => route.fulfill({ status: 409, json: {
    type: 'about:blank', title: 'Conflict', status: 409, code: 'TERMS_EFFECTIVE_OVERLAP', retryable: false,
  } }));
  await page.goto(`./versions/${draftVersion.versionId}`);
  await page.getByLabel('Fecha de vigencia').fill('2026-09-01T07:00');
  await page.getByRole('button', { name: 'Programar publicación' }).click();
  await page.getByRole('button', { name: 'Confirmar publicación' }).click();
  await expect(page.getByRole('alert')).toContainText('conflicto');
});
