import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('favorites toggle from cards and detail, persist, and combine with room search', async ({ page }) => {
  await page.goto('/collection');
  const item = roomA.exhibits[0];
  const favorite = page.getByRole('button', { name: `Yêu thích ${item.name}`, exact: true });
  await expect(favorite).toBeVisible({ timeout: 3000 });
  await favorite.focus(); await favorite.press('Space');
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('checkbox', { name: 'Chỉ hiện vật yêu thích trong phòng này' }).check();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).fill('no-match');
  await expect(page.getByText(/Không có hiện vật yêu thích khớp/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).clear();
  await page.getByRole('link', { name: `Xem chi tiết ${item.name}`, exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: `Yêu thích ${item.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: `Yêu thích ${item.name}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Yêu thích ${item.name}`, exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('removed exhibits are never restored from favorite storage', async ({ page }) => {
  await page.addInitScript(({ roomId, exhibitId }) => localStorage.setItem('aura:visitor:favorites:v1', JSON.stringify({ version: 1, value: [{ roomId, exhibitId }] })), { roomId: roomA.id, exhibitId: roomA.exhibits[0].id });
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: [] })));
  await page.goto('/collection');
  await page.getByRole('checkbox', { name: 'Chỉ hiện vật yêu thích trong phòng này' }).check();
  await expect(page.getByRole('link', { name: `Xem chi tiết ${roomA.exhibits[0].name}`, exact: true })).toHaveCount(0);
});

test('corrupt and unavailable storage keep favorite actions usable with honest status', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aura:visitor:favorites:v1', '{broken'));
  await page.goto('/collection');
  await expect(page.getByText(/Dữ liệu đã lưu không hợp lệ/)).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'QuotaExceededError'); };
  });
  const favorite = page.getByRole('button', { name: `Yêu thích ${roomA.exhibits[0].name}`, exact: true });
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Không thể lưu trên trình duyệt/)).toBeVisible();
});
