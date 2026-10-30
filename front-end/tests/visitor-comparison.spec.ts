import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('comparison limits to three, supports room switching, keyboard dialog and removal', async ({ page }) => {
  await page.goto('/collection');
  const select = (name: string) => page.getByRole('button', { name: `So sánh ${name}`, exact: true });
  await expect(select(roomA.exhibits[0].name)).toBeVisible({ timeout: 3000 });
  for (const item of roomA.exhibits.slice(0, 3)) await select(item.name).click();
  await select(roomA.exhibits[3].name).click();
  await expect(page.getByRole('status', { name: 'Trạng thái so sánh' })).toContainText('Tối đa 3');
  await expect(select(roomA.exhibits[3].name)).toHaveAttribute('aria-pressed', 'false');
  await select(roomA.exhibits[2].name).click();
  await page.getByRole('button', { name: roomB.name, exact: true }).click();
  await select(roomB.exhibits[0].name).press('Enter');
  const opener = page.getByRole('button', { name: 'Mở so sánh (3)', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'So sánh hiện vật' });
  await expect(dialog.getByRole('heading', { level: 3 })).toHaveText([roomA.exhibits[0].name, roomA.exhibits[1].name, roomB.exhibits[0].name]);
  await expect(dialog.getByText(roomB.name, { exact: true })).toBeVisible();
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.getByRole('button', { name: `Bỏ so sánh ${roomA.exhibits[0].name}`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở so sánh (2)', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Xóa lựa chọn so sánh' }).click();
  await expect(page.getByRole('button', { name: 'Mở so sánh (0)', exact: true })).toBeDisabled();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('comparison removes unavailable content on refresh without affecting filtering', async ({ page }) => {
  await page.goto('/collection');
  for (const item of roomA.exhibits.slice(0, 2)) await page.getByRole('button', { name: `So sánh ${item.name}`, exact: true }).click();
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).fill('Hiện vật 5');
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(1);
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: [roomA.exhibits[4]] })));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở so sánh (2)', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Lựa chọn so sánh' })).toContainText('Hiện vật không khả dụng');
});
