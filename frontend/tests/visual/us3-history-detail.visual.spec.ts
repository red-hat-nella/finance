import { expect, test } from '@playwright/test';
import {
  capturePage,
  expectCentered,
  expectFullText,
  expectNoOverflow,
} from '../support/geometry';

test('@visual history and detail adapt without clipping or overlap', async ({
  page,
}, testInfo) => {
  await page.goto('/evaluations');
  await expect(
    page.getByRole('heading', { name: 'Histórico de evaluaciones' }),
  ).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const table = page.locator('app-history-table');
  const list = page.locator('app-history-list');
  if (viewport!.width >= 960) {
    await expect(table).toBeVisible();
    await expect(list).toBeHidden();
    await expect(
      table.getByRole('columnheader', { name: 'Fecha y hora' }),
    ).toHaveAttribute('aria-sort', 'descending');
  } else {
    await expect(table).toBeHidden();
    await expect(list).toBeVisible();
  }
  const filtersBox = await page.locator('app-history-filters form').boundingBox();
  const firstFilterBox = await page
    .locator('app-history-filters mat-form-field')
    .first()
    .boundingBox();
  expect(filtersBox).not.toBeNull();
  expect(firstFilterBox).not.toBeNull();
  expect(firstFilterBox!.y - filtersBox!.y).toBeGreaterThanOrEqual(15);
  expect(firstFilterBox!.x - filtersBox!.x).toBeGreaterThanOrEqual(15);
  await expectCentered(page.locator('main app-responsive-container'), page);
  await expectNoOverflow(page);
  await capturePage(page, testInfo, 'history');

  const openLink = page
    .locator('app-history-table:visible, app-history-list:visible')
    .getByRole('link', { name: /Abrir/ })
    .first();
  await expect(openLink).toBeVisible();
  await openLink.click();
  await expect(page).toHaveURL(/\/evaluations\/[0-9a-f-]{36}\/details$/i);
  await expect(
    page.getByRole('heading', { name: 'Detalle de evaluación' }),
  ).toBeVisible();
  await expect(page.getByText('Datos evaluados del solicitante')).toBeVisible();
  await expectFullText(page.locator('.wide-value code'));
  await expectNoOverflow(page);
  await capturePage(page, testInfo, 'detail');
});
