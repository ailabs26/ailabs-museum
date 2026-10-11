import { expect, test } from '@playwright/test';

// Compare rendered scene pixels, excluding focus outlines and the DOM toolbar.
const SCENE_CAPTURE = { style: 'canvas { outline: none !important; } [aria-label="Điều khiển góc nhìn"] { visibility: hidden !important; }' };

test('context loss exits the renderer and focuses a readable fallback', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context loss extension unavailable in test browser');
    extension.loseContext();
  });
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('status')).toBeFocused();
  await expect(page.getByRole('list', { name: 'Các hình khối mẫu' }).getByRole('listitem')).toHaveCount(5);
});

test('unavailable WebGL preserves the sample catalogue', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Các hình khối mẫu' }).getByRole('listitem')).toHaveCount(5);
});

test('failed scene chunk leaves navigation and catalogue available', async ({ page }) => {
  await page.route('**/*MuseumScene*', (route) => route.abort());
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Aura Museum' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Các hình khối mẫu' }).getByRole('listitem')).toHaveCount(5);
});

test('focused keyboard navigation and reset work without trapping focus', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  await canvas.focus();
  const initial = await canvas.screenshot(SCENE_CAPTURE);
  await canvas.press('ArrowLeft');
  await expect.poll(async () => (await canvas.screenshot(SCENE_CAPTURE)).equals(initial)).toBe(false);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  await expect.poll(async () => (await canvas.screenshot(SCENE_CAPTURE)).equals(initial)).toBe(true);
  await page.getByRole('button', { name: 'Dừng 3D' }).focus();
  await page.keyboard.press('ArrowLeft');
  expect((await canvas.screenshot(SCENE_CAPTURE)).equals(initial)).toBe(true);
  await canvas.focus();
  await page.keyboard.press('Tab');
  await expect(canvas).not.toBeFocused();
});

test('mouse navigation changes the rendered view', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const before = await canvas.screenshot(SCENE_CAPTURE);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await canvas.screenshot(SCENE_CAPTURE)).equals(before)).toBe(false);
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
