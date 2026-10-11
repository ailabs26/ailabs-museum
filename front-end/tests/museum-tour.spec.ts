import { expect, test } from '@playwright/test';

test('HTML entry and SPA route expose the museum with public navigation', async ({ page }) => {
  for (const path of ['/tour.html', '/tour']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Không gian của hình khối' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Aura Museum' })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Aura Museum' }).click();
  await expect(page.getByRole('heading', { name: 'Bảo tàng WebXR Aura' })).toBeVisible();
  await page.goto('/admin/login');
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
