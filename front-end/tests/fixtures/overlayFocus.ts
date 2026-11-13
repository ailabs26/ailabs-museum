import { expect, type Locator, type Page } from '@playwright/test';

export async function expectTrapped(page: Page, dialog: Locator, steps = 12) {
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < steps; index++) {
      await page.keyboard.press(key);
      await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
  }
}
