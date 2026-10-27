import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { roomB, envelope } from './fixtures/museumContent';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';
import { installXrSimulation } from './fixtures/museumXr';

async function useOverlay(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
  });
}

test.beforeEach(async ({ page }) => {
  await installMuseumApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('opening fills the viewport and detail selection never shrinks Canvas', async ({ page }, testInfo) => {
  await useOverlay(page);
  await installRendererProbe(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  await canvas.screenshot({ path: testInfo.outputPath('gallery.png') });
  await writeFile(testInfo.outputPath('renderer.json'), JSON.stringify(await readRendererProbe(page), null, 2));
  const bounds = await canvas.boundingBox();
  expect(bounds).toEqual({ x: 0, y: 0, ...page.viewportSize()! });
  await expect(page.getByRole('dialog', { name: 'Tham quan bảo tàng' })).toBeVisible();
  await page.getByRole('button', { name: 'Lia camera tới Hiện vật 1', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  expect(await canvas.boundingBox()).toEqual(bounds);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
});

test('three open/close cycles restore scroll, focus, background and release renderers', async ({ page }) => {
  await useOverlay(page);
  await installRendererProbe(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tour');
  const opener = page.getByRole('button', { name: 'Mở phòng 3D' });
  for (let cycle = 0; cycle < 3; cycle++) {
    await opener.focus();
    const scroll = await page.evaluate(() => window.scrollY);
    await opener.press('Enter');
    await expect(page.getByLabel('Phòng trưng bày 3D')).toBeFocused();
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(async () => (await readRendererProbe(page)).filter(item => item.live).length).toBe(1);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    expect(await page.evaluate(() => document.querySelector('#root')?.hasAttribute('inert'))).toBe(false);
    await expect.poll(async () => (await readRendererProbe(page)).filter(item => item.live).length).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('rejected native fullscreen keeps a usable overlay', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen denied'));
  });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
});

test('a late native fullscreen grant after closing is released without reopening the tour', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeFullscreen: { element: Element | null } = { element: null };
    Reflect.set(window, 'lateFullscreenExits', 0);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => nativeFullscreen.element });
    document.exitFullscreen = async () => {
      nativeFullscreen.element = null;
      Reflect.set(window, 'lateFullscreenExits', Reflect.get(window, 'lateFullscreenExits') + 1);
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    Element.prototype.requestFullscreen = function () {
      return new Promise<void>(resolve => {
        Reflect.set(window, 'grantLateFullscreen', () => {
          nativeFullscreen.element = this; document.dispatchEvent(new Event('fullscreenchange')); resolve();
        });
      });
    };
  });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
  await page.evaluate(() => Reflect.get(window, 'grantLateFullscreen')());
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'lateFullscreenExits'))).toBe(1);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.locator('[data-immersive-tour]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
});

test('external native fullscreen exit reconciles tour state', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('data-immersive-tour'))).toBe('true');
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
});

test('closing preserves selected exhibit for the readable page', async ({ page }) => {
  await useOverlay(page);
  await page.goto('/tour?exhibit=10000000-0000-4000-8000-000000000001');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await page.getByRole('button', { name: 'Lia camera tới Hiện vật 1', exact: true }).click();
  await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('exhibit')).toBe(true);
});

test('room loading preserves native fullscreen and its reachable exit', async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/rooms/ceramics', async route => { await wait; await fulfillMuseum(route, envelope(roomB)); });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await page.getByLabel('Chọn phòng trưng bày', { exact: true }).selectOption('ceramics');
  await expect(page.getByRole('dialog', { name: 'Tham quan bảo tàng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thoát tham quan', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement?.getAttribute('data-immersive-tour'))).toBe('true');
  release();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Tham quan bảo tàng' }).getByRole('heading', { name: 'Gốm Việt' })).toBeVisible();
});

test('Escape can close the tour after an XR scene unmounts during room loading', async ({ page }) => {
  await useOverlay(page); await installXrSimulation(page);
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/rooms/ceramics', async route => { await wait; await fulfillMuseum(route, envelope(roomB)); });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  await page.getByLabel('Chọn phòng trưng bày', { exact: true }).selectOption('ceramics');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.keyboard.press('Escape');
  try { await expect(page.locator('[data-immersive-tour]')).toHaveCount(0); }
  finally { release(); }
});
