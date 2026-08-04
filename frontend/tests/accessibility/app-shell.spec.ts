import { expectVisibleFocus, expectWcagAA } from '../support/accessibility';
import { test, expect } from '../support/fixtures';
import { expectTouchTargets } from '../support/geometry';

test('app shell exposes keyboard and analyst navigation semantics', async ({
  analystPage: page,
}) => {
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('main#main-content')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(
    page.getByRole('navigation').getByText('Nueva solicitud'),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation').getByText('Histórico'),
  ).toBeVisible();
  await expectTouchTargets(page.locator('header a'));

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skipLink).toBeFocused();
  await expectVisibleFocus(skipLink);
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main-content')).toBeFocused();
  await expectWcagAA(page);
});
