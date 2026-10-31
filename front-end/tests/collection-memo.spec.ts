import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

test('collection keeps deterministic order and updates search and favorites after refetch', async ({ page }) => {
  await installMuseumApi(page);
  const reordered = [roomA.exhibits[2], roomA.exhibits[1], roomA.exhibits[0]].map(item => ({ ...item, displayOrder: 0 }));
  let exhibits = reordered;
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits })));
  await page.goto('/collection');
  const cards = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Hiện vật 1', 'Hiện vật 2', 'Hiện vật 3']);
  await page.getByRole('button', { name: 'Yêu thích Hiện vật 2', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Chỉ hiện vật yêu thích trong phòng này' }).check();
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).fill('Mô tả hiện vật 2');
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Hiện vật 2']);
  exhibits = [{ ...reordered[1], name: 'Nội dung mới', description: 'Đã xuất bản lại' }];
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(cards).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).clear();
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Nội dung mới']);
});
