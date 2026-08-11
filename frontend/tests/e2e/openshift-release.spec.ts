import { expect, test } from '@playwright/test';

test('@visual OpenShift release preserves the responsive application shell', async ({ page }, testInfo) => {
  await page.goto('/applications/new');
  await expect(page.getByRole('heading', { name: 'Nueva evaluación' })).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('body')).not.toContainText(/token|kubeconfig|database-password/i);
  await page.screenshot({ path: testInfo.outputPath(`openshift-${viewport?.width}x${viewport?.height}.png`), fullPage: true });
});
