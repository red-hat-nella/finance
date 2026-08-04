import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page } from '@playwright/test';

export async function expectWcagAA(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

export async function expectVisibleFocus(locator: Locator): Promise<void> {
  const alreadyFocused = await locator.evaluate(
    (element) => element === document.activeElement,
  );
  if (!alreadyFocused) await locator.focus();
  const outline = await locator.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  expect(outline).not.toBe('none');
}

export async function useTwoHundredPercentZoom(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'html { zoom: 2; }' });
}

export async function useReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
