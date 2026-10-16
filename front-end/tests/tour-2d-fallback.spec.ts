import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('[F02] panel link follows selected exhibit and navigates to readable 2D detail', async ({ page }) => {
  await page.goto('/tour?room=sculpture');
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
  const link = page.getByRole('link', { name: 'Đọc chi tiết 2D', exact: true });
  await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[1].id}`);
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 3', exact: true }).click();
  await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[2].id}`);
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(link).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
  await expect(link).toHaveAttribute('href', `/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
  await link.focus();
  await link.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bình gốm');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('canvas')).toHaveCount(0);
});
