import { exitMuseumIfOpen, openMuseumTools } from './fixtures/museumUi';
import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe } from './fixtures/museumProbe';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

// Compare rendered scene pixels, excluding focus outlines and the DOM toolbar.
const SCENE_CAPTURE = { style: 'canvas { outline: none !important; } [aria-label="Điều khiển góc nhìn"], [data-navigation-mode] { visibility: hidden !important; }' };

test('opening and stopping the scene keep keyboard focus in the tour', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeFocused();
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
});

test('gallery resizes on mobile and caps the drawing buffer', async ({ page }, testInfo) => {
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('gallery-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.width / element.clientWidth)).toBeLessThanOrEqual(1.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu' })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('gallery-mobile.png'), fullPage: true });
});

test('zoom stops at both safe boundaries', async ({ page }) => {
  // Many real clicks + pixel captures can exceed 30s on software WebGL.
  test.setTimeout(60_000);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  for (const label of ['Đến gần', 'Lùi xa']) {
    await openMuseumTools(page);
    for (let i = 0; i < 12; i++) await page.getByRole('button', { name: label }).click();
    const boundary = await canvas.screenshot(SCENE_CAPTURE);
    await page.getByRole('button', { name: label }).click();
    expect((await canvas.screenshot(SCENE_CAPTURE)).equals(boundary)).toBe(true);
  }
});

test('reduced motion stops camera inertia when the drag ends', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + 100);
  await page.mouse.up();
  const first = await canvas.screenshot(SCENE_CAPTURE);
  expect((await canvas.screenshot(SCENE_CAPTURE)).equals(first)).toBe(true);
});

test('unrecovered context exits the renderer after its deadline and focuses a readable fallback', async ({ page }) => {
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
  await expect(page.locator('[data-webgl-status="recovering"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('status')).toBeFocused();
  await expect(page.locator('#museum-catalogue li')).toHaveCount(5);
});

test('unavailable WebGL preserves the API catalogue', async ({ page }) => {
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
  await expect(page.locator('#museum-catalogue li')).toHaveCount(5);
});

test('failed scene chunk leaves navigation and catalogue available', async ({ page }) => {
  await page.route('**/*MuseumScene*', (route) => route.abort());
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Aura Museum — Trang chủ', exact: true })).toBeVisible();
  await expect(page.locator('#museum-catalogue li')).toHaveCount(5);
});

test('focused keyboard navigation and reset work without trapping focus', async ({ page }) => {
  await installRendererProbe(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await canvas.focus();
  const initial = await canvas.screenshot(SCENE_CAPTURE);
  const readCamera = () => page.evaluate(() => { const camera = window.museumProbe.at(-1)!.camera!.deref()!; return [camera.position.toArray(), camera.quaternion.toArray()]; });
  const initialCamera = await readCamera();
  await canvas.press('ArrowLeft');
  await expect.poll(async () => (await canvas.screenshot(SCENE_CAPTURE)).equals(initial)).toBe(false);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  // Toolbar commands reach the camera through a React effect after the click.
  await expect.poll(readCamera).toEqual(initialCamera);
  await expect.poll(async () => (await canvas.screenshot(SCENE_CAPTURE)).equals(initial)).toBe(true);
  await page.getByRole('button', { name: 'Thoát tham quan' }).focus();
  await page.keyboard.press('ArrowLeft');
  // Focus can scroll the canvas beneath a stationary pointer and change hover
  // pixels. The outside shortcut invariant is that camera transform stays put.
  expect(await readCamera()).toEqual(initialCamera);
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

test('API catalogue stays readable without starting WebGL', async ({ page }) => {
  const sceneRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('MuseumScene')) sceneRequests.push(request.url());
  });
  await page.goto('/tour.html');
  await expect(page.getByRole('heading', { name: 'Trong phòng trưng bày' })).toBeVisible();
  await expect(page.locator('#museum-catalogue li')).toHaveCount(5);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(sceneRequests).toEqual([]);
});

test('scene starts on demand and releases canvas when stopped', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Trong phòng trưng bày' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('HTML entry and SPA route expose the museum with public navigation', async ({ page }) => {
  for (const path of ['/tour.html', '/tour']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Không gian của hình khối' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Aura Museum — Trang chủ', exact: true })).toBeVisible();
  }
  await exitMuseumIfOpen(page);
  await page.getByRole('banner').getByRole('link', { name: 'Aura Museum — Trang chủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chạm vào Di sản/ })).toBeVisible();
  await page.goto('/admin/login');
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
