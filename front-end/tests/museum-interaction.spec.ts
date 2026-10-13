import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('keyboard catalogue selection has one pressed item and clears on room change', async ({ page }) => {
  await page.goto('/tour');
  const first = page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true });
  await first.focus();
  await first.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  const second = page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true });
  await second.press('Space');
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('canvas')).toHaveCount(0);
});
