import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('public skip link moves keyboard focus to main', async ({ page }) => {
  await page.goto('/collection');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Đến nội dung chính' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('catalogue panel allows Tab escape and restores the keyboard trigger', async ({ page }) => {
  await page.goto('/tour');
  const trigger = page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true });
  for (let index = 0; index < 30 && !await trigger.evaluate(element => element === document.activeElement); index++) {
    await page.keyboard.press('Tab');
  }
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(panel.getByRole('button', { name: 'Đóng chi tiết hiện vật' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('link', { name: 'Đọc chi tiết 2D' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('closing details after stopping 3D falls back to the start control', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).press('Enter');
  const hotspot = page.getByRole('button', { name: 'Điểm tương tác Hiện vật 1', exact: true });
  await hotspot.press('Enter');
  await expect(page.getByRole('complementary')).toBeVisible();
  await page.getByRole('button', { name: 'Dừng 3D', exact: true }).press('Enter');
  await expect(hotspot).toHaveCount(0);
  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).press('Enter');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D', exact: true })).toBeFocused();
});

test('closing details after renderer failure keeps focus in readable tour content', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 1', exact: true }).press('Enter');
  await page.getByLabel('Phòng trưng bày 3D', { exact: true }).evaluate(canvas => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1440]) {
    test(`public skip link is visible and keyboard operable at ${width}px in ${colorScheme}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.keyboard.press('Tab');
      const skipLink = page.getByRole('link', { name: 'Đến nội dung chính' });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeInViewport();
      await expect(skipLink).toHaveCSS('outline-style', 'solid');
      await page.screenshot({ path: testInfo.outputPath('public-keyboard-focus.png') });
      await page.keyboard.press('Enter');
      await expect(page.getByRole('main')).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
