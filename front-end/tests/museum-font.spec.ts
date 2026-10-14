import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

const vietnameseTitle = '[Mẫu] Bình nước dã chiến';

test.beforeEach(async ({ page }) => {
  await installMuseumApi(page);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA,
    exhibits: roomA.exhibits.map((exhibit, index) => index === 1 ? { ...exhibit, name: vietnameseTitle } : exhibit),
  })));
});

test('Vietnamese tour headings use a consistent serif font and keep detail keyboard behavior', async ({ page }) => {
  await page.goto('/tour');
  const trigger = page.getByRole('button', { name: `Xem chi tiết ${vietnameseTitle}`, exact: true });
  await trigger.click();
  const selectors = ['#museum-catalogue li:nth-child(2) h3', 'aside h2', 'main h1', '[class*="introTitle"]'];
  for (const selector of selectors) {
    const heading = page.locator(selector);
    await expect(heading).toHaveCSS('font-family', '"Times New Roman", serif');
    expect(await heading.evaluate((element) => element.textContent === element.textContent?.normalize('NFC'))).toBe(true);
  }
  // Installed font families vary by OS; the reported bug was reproduced on Windows Edge.
  if (process.platform === 'win32') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    for (const selector of selectors) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      expect(fonts.map((font) => font.familyName)).toEqual(['Times New Roman']);
    }
    await cdp.detach();
  }
  await expect(page.locator('aside h2')).toHaveText(vietnameseTitle);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật', exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('canvas exhibit plaque draws the Vietnamese title using the same serif font', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: { text: string; font: string }[] = [];
    Reflect.set(window, '__museumLabelText', calls);
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof fillText>) {
      calls.push({ text: args[0], font: this.font });
      return fillText.apply(this, args);
    };
  });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((title) => {
    const calls = Reflect.get(window, '__museumLabelText') as { text: string; font: string }[];
    return calls.filter((call) => call.text === title).map((call) => call.font);
  }, vietnameseTitle)).toContain('30px "Times New Roman", serif');
});
