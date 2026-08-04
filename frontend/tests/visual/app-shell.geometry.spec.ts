import { test, expect } from '../support/fixtures';
import {
  expectCentered,
  expectInsideViewport,
  expectNoOverflow,
} from '../support/geometry';

test('@visual app shell is centered and contained at 320px', async ({
  analystPage: page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.reload();

  await expectNoOverflow(page);
  await expectCentered(page.locator('main app-responsive-container'), page);
  await expectInsideViewport(page.locator('header'), page);
  await expectInsideViewport(page.locator('footer'), page);
  await expect(page.locator('main')).not.toHaveCSS('overflow-x', 'scroll');
});
