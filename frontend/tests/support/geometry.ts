import { expect, Locator, Page, TestInfo } from '@playwright/test';

export async function expectNoOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    clipped: [
      ...document.querySelectorAll<HTMLElement>('h1,h2,h3,p,label,button,a'),
    ]
      .filter((element) => !element.classList.contains('sr-only'))
      .filter((element) => !element.querySelector('app-copy-id'))
      .filter((element) => !element.hasAttribute('mat-icon-button'))
      .filter((element) => element.scrollWidth > element.clientWidth + 2)
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.clipped).toEqual([]);
}

export async function expectTouchTargets(
  locator: Locator,
  minimum = 44,
): Promise<void> {
  for (const element of await locator.all()) {
    const box = await element.boundingBox();
    expect(box, 'interactive element must have a bounding box').not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(minimum);
    expect(box!.width).toBeGreaterThanOrEqual(minimum);
  }
}

export async function expectInsideViewport(
  locator: Locator,
  page: Page,
): Promise<void> {
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
}

export async function expectCentered(
  locator: Locator,
  page: Page,
  tolerance = 2,
): Promise<void> {
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(
    Math.abs(box!.x + box!.width / 2 - viewport!.width / 2),
  ).toBeLessThanOrEqual(tolerance);
}

export async function expectFullText(locator: Locator): Promise<void> {
  const clipped = await locator.evaluate(
    (element) =>
      element.scrollWidth > element.clientWidth + 2 ||
      element.scrollHeight > element.clientHeight + 2,
  );
  expect(clipped).toBeFalsy();
}

export async function capturePage(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}
