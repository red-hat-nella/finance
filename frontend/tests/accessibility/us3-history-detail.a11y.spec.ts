import { expect, test } from '@playwright/test';
import { expectVisibleFocus, expectWcagAA } from '../support/accessibility';
import { expectNoOverflow } from '../support/geometry';

async function tabTo(
  page: import('@playwright/test').Page,
  target: import('@playwright/test').Locator,
): Promise<void> {
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement))
      return;
  }
  throw new Error('The target was not reachable in the expected tab order.');
}

test('history and detail support keyboard navigation and WCAG AA', async ({
  page,
}) => {
  await page.goto('/evaluations');
  await expect(
    page.getByRole('heading', { name: 'Histórico de evaluaciones' }),
  ).toBeVisible();
  await expectWcagAA(page);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (viewport!.width >= 960)
    await expect(
      page.getByRole('columnheader', { name: 'Fecha y hora' }),
    ).toHaveAttribute('aria-sort', 'descending');

  const openLink = page
    .locator('app-history-table:visible, app-history-list:visible')
    .getByRole('link', { name: /Abrir/ })
    .first();
  await tabTo(page, openLink);
  await expect(openLink).toBeFocused();
  await expectVisibleFocus(openLink);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Detalle de evaluación' }),
  ).toBeVisible();

  const copyId = page.getByRole('button', { name: 'Copiar identificador' });
  await tabTo(page, copyId);
  await expect(copyId).toBeFocused();
  await expectVisibleFocus(copyId);
  await expectWcagAA(page);
  await expectNoOverflow(page);
});
