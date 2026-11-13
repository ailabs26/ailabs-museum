import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';

test('reading preferences persist, stay bounded, and reset without changing semantic content', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  const toggle = page.getByRole('button', { name: 'Chế độ đọc', exact: true });
  await expect(toggle).toBeVisible({ timeout: 3000 });
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const increase = page.getByRole('button', { name: 'Tăng cỡ chữ' });
  for (let i = 0; i < 5; i++) await increase.click();
  await expect(increase).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Cỡ chữ đọc' })).toHaveText('Cỡ chữ 150%');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: 'Cỡ chữ đọc' })).toHaveText('Cỡ chữ 150%');
  await expect(page.getByRole('heading', { name: 'Câu chuyện hiện vật', level: 2 })).toBeVisible();
  await expect(page.getByText(roomA.exhibits[0].description, { exact: true })).toHaveCSS('font-size', '24px');
  await page.getByRole('button', { name: 'Đặt lại chế độ đọc' }).press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Giảm cỡ chữ' })).toBeDisabled();
});
