import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { draftVersion, mockAdminApi } from '../support/admin-fixtures';

for (const path of ['./versions', './versions/new', `./versions/${draftVersion.versionId}`]) {
  test(`admin screen ${path} meets WCAG 2.2 AA and keyboard operation`, async ({ page }) => {
    await mockAdminApi(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
