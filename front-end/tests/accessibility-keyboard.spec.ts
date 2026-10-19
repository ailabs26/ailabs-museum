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
