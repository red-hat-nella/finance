import { test as base, expect, Page } from '@playwright/test';

type AppFixtures = { analystPage: Page };

export const test = base.extend<AppFixtures>({
  analystPage: async ({ page }, use) => {
    await page.goto('/applications/new');
    await use(page);
  },
});

export { expect };
