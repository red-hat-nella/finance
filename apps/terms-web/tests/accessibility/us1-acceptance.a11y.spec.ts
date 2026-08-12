import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockPendingTerms } from '../support/terms-fixtures';

test('gate supports keyboard, skip link and WCAG AA', async ({ page }) => {
  await mockPendingTerms(page);
  await page.goto('./');
  const skipLink = page.getByRole('link', { name: 'Saltar al contenido' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('focus resets, zoom 200% has no horizontal overflow and reduced motion is honored', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPendingTerms(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const viewport = page.viewportSize();
  await page.evaluate((useBrowserZoom) => {
    if (useBrowserZoom) document.documentElement.style.zoom = '2';
    else document.documentElement.style.fontSize = '200%';
  }, (viewport?.width ?? 0) >= 768);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const duration = await page.locator('body').evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(['0s', '0.00001s', '1e-05s']).toContain(duration);
});
