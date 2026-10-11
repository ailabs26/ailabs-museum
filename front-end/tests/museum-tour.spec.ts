import { expect, test } from '@playwright/test';

test('mouse navigation changes the rendered view', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const before = await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
});

test('sample catalogue stays readable without starting WebGL', async ({ page }) => {
  const sceneRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('MuseumScene')) sceneRequests.push(request.url());
  });
  await page.goto('/tour.html');
  await expect(page.getByRole('heading', { name: 'Trong phòng trưng bày' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Các hình khối mẫu' }).getByRole('listitem')).toHaveCount(5);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(sceneRequests).toEqual([]);
});

test('scene starts on demand and releases canvas when stopped', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Dừng 3D' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Trong phòng trưng bày' })).toBeVisible();
  expect(errors).toEqual([]);
});

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
