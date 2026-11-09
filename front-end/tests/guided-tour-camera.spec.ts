import { expect, test, type Page } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { installRendererProbe, waitForRendererIdle } from './fixtures/museumProbe';
import { roomA, roomB, envelope } from './fixtures/museumContent';
import { installXrSimulation } from './fixtures/museumXr';
import { createMuseumGlb, installFiveModels } from './fixtures/museumGlb';
import { createHash } from 'node:crypto';
import type { Object3D } from 'three';

test.setTimeout(120_000);
const bar = (page: Page) => page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
const position = (page: Page) => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray());

async function open(page: Page, reduced = true, slug = 'sculpture', setup?: () => Promise<unknown>) {
  await installMuseumApi(page);
  await setup?.();
  await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`/tour.html?room=${slug}`);
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(bar(page)).toBeVisible();
}

test('arrival selects in CMS order, dwell pauses with time remaining, completes once without wrapping', async ({ page }) => {
  await open(page);
  const clockStart = new Date('2026-11-09T00:00:00Z');
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(clockStart);
  await expect(bar(page)).toHaveAttribute('data-status', 'idle');
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).evaluate(button => button.click());
  await page.clock.runFor(100);
  for (let i = 0; i < 5; i++) {
    await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[i].id);
    await page.clock.runFor(100);
    await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
    await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[i].id}`));
    if (i === 0) {
      await page.clock.runFor(5000);
      await page.getByRole('button', { name: 'Tạm dừng', exact: true }).evaluate(button => button.click());
      await page.clock.runFor(30_000);
      await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[0].id);
      await page.getByRole('button', { name: 'Tiếp tục', exact: true }).evaluate(button => button.click());
      await page.clock.runFor(100);
      await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
      await page.clock.runFor(9000);
      await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[0].id);
      await page.clock.runFor(1100);
    } else await page.clock.runFor(15_100);
  }
  await expect(bar(page)).toHaveAttribute('data-status', 'completed');
  await page.clock.runFor(60_000);
  await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[4].id);
  await page.getByRole('button', { name: 'Hiện vật trước', exact: true }).evaluate(button => button.click());
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[3].id);
});

test('normal travel detours colliders, pauses at actual pose, replans on Next and yields to WASD', async ({ page }, info) => {
  await open(page, false);
  await waitForRendererIdle(page);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'moving');
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await page.evaluate(() => {
    const record = window.museumProbe.at(-1)!;
    const renderer = record.renderer.deref()!, render = renderer.render;
    Reflect.set(window, 'guidedSamples', []);
    Reflect.set(window, 'guidedRotations', []);
    Reflect.set(window, 'guidedRolls', []);
    renderer.render = function(scene, camera) {
      (Reflect.get(window, 'guidedSamples') as number[][]).push(camera.position.toArray());
      (Reflect.get(window, 'guidedRotations') as number[][]).push(camera.quaternion.toArray());
      (Reflect.get(window, 'guidedRolls') as number[]).push(camera.rotation.clone().reorder('YXZ').z);
      return render.call(this, scene, camera);
    };
  });
  const before = await position(page);
  await expect.poll(() => position(page)).not.toEqual(before);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const paused = await position(page);
  await waitForRendererIdle(page);
  expect(await position(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  try {
    await expect(bar(page)).toHaveAttribute('data-phase', 'viewing', { timeout: 90_000 });
  } finally {
    await info.attach('guided-camera-samples.json', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => ({
      samples: Reflect.get(window, 'guidedSamples'), rotations: Reflect.get(window, 'guidedRotations'), frames: window.museumProbe.at(-1)!.frames,
      position: window.museumProbe.at(-1)!.camera!.deref()!.position.toArray(),
      quaternion: window.museumProbe.at(-1)!.camera!.deref()!.quaternion.toArray(), hidden: document.hidden,
    }))) });
  }
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[1].id}`));
  const samples = await page.evaluate(() => Reflect.get(window, 'guidedSamples') as number[][]);
  expect(samples.length).toBeGreaterThan(10);
  for (const [x, , z] of samples) {
    expect(Math.abs(x)).toBeLessThanOrEqual(6.55);
    expect(Math.abs(z)).toBeLessThanOrEqual(7.55);
    expect(Math.abs(x) < 1.47 && Math.abs(z) < 1.47).toBe(false);
  }
  const orientation = await page.evaluate(() => ({ rotations: Reflect.get(window, 'guidedRotations') as number[][], rolls: Reflect.get(window, 'guidedRolls') as number[] }));
  for (let i = 1; i < orientation.rotations.length; i++) {
    const dot = orientation.rotations[i].reduce((sum, v, axis) => sum + v * orientation.rotations[i - 1][axis], 0);
    expect(2 * Math.acos(Math.min(1, Math.abs(dot)))).toBeLessThanOrEqual(0.06501);
  }
  expect(Math.max(...orientation.rolls.map(Math.abs))).toBeLessThan(0.00001);
  await page.screenshot({ path: info.outputPath('guided-desktop.png') });
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await canvas.focus();
  const manualStart = await position(page);
  await page.keyboard.down('d');
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await expect.poll(async () => Math.hypot(...(await position(page)).map((v, i) => v - manualStart[i]))).toBeGreaterThan(0.05);
  await page.keyboard.up('d');
  await waitForRendererIdle(page);
  const moved = await position(page);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).evaluate(button => button.click());
  expect(Math.hypot(...(await position(page)).map((v, i) => v - moved[i]))).toBeLessThan(0.2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await page.getByRole('button', { name: 'Thoát hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-status', 'idle');
});

test('XR and actual context loss pause without auto-resume or replacing the Canvas', async ({ page }) => {
  await installXrSimulation(page);
  await open(page, false);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  const tracked = await page.evaluate(() => {
    const record = window.museumProbe.at(-1)!;
    return { origin: record.camera!.deref()!.parent!.position.toArray(), frames: record.frames };
  });
  await expect.poll(() => page.evaluate(() => window.museumProbe.at(-1)!.frames)).toBeGreaterThan(tracked.frames + 3);
  expect(await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.position.toArray())).toEqual(tracked.origin);
  await page.evaluate(() => window.museumXrFixture.session!.end());
  await expect(page.locator('[data-xr-phase="idle"]')).toBeVisible();
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByLabel('Phòng trưng bày 3D', { exact: true }).evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    Reflect.set(window, 'guidedRestore', () => extension.restoreContext());
    extension.loseContext();
  });
  await expect(page.locator('[data-webgl-status="recovering"]')).toBeVisible();
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await page.evaluate(() => Reflect.get(window, 'guidedRestore')());
  await expect(page.locator('[data-webgl-status="ready"]')).toBeVisible();
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  expect(await page.evaluate(() => window.museumProbe.length)).toBe(1);
});

test('CMS order wins over geometry and an unsafe step retains DOM details with Skip', async ({ page }) => {
  const exhibits = roomA.exhibits.map((e, i) => ({ ...e, displayOrder: [2, 1, 0, 3, 4][i], positionX: i === 1 ? 40 : e.positionX }));
  await open(page, true, 'sculpture', () => page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits }))));
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await expect(bar(page)).toHaveAttribute('data-exhibit', exhibits[2].id);
  const safe = await position(page);
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'blocked');
  expect(await position(page)).toEqual(safe);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibits[1].name);
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await expect(bar(page)).toHaveAttribute('data-exhibit', exhibits[0].id);
  await page.getByRole('button', { name: 'Lia camera tới Hiện vật 5', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-status', 'idle');
  await expect(page).toHaveURL(new RegExp(`exhibit=${exhibits[4].id}`));
});

test('empty room disables Start, one exhibit finishes, close/reopen requires explicit resume', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined }); });
  await open(page, true, 'empty');
  await expect(page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true })).toBeDisabled();
  await page.getByLabel('Chọn phòng trưng bày', { exact: true }).selectOption('ceramics');
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await expect(bar(page)).toHaveAttribute('data-exhibit', roomB.exhibits[0].id);
  await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await page.clock.install();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await page.clock.runFor(15_100);
  await expect(bar(page)).toHaveAttribute('data-status', 'completed');
});

test('CMS reorder keeps stable ID and removed current exhibit pauses on a valid successor', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  let updated = { ...roomA, exhibits: [...roomA.exhibits].reverse().map((e, i) => ({ ...e, displayOrder: i })) };
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope(updated)));
  await page.locator('details[data-catalogue] summary').click();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).last().click();
  await expect(bar(page)).toContainText('5/5');
  await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[0].id);
  updated = { ...updated, exhibits: updated.exhibits.filter(e => e.id !== roomA.exhibits[0].id) };
  await page.getByRole('button', { name: 'Làm mới', exact: true }).last().click();
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[1].id);
});

test.describe('mobile guided controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('reduced motion and touch takeover retain usable controls and readable details', async ({ page }, info) => {
    await open(page);
    await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).tap();
    await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
    await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).tap();
    await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
    await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[1].id);
    await page.getByRole('button', { name: 'Hiện vật trước', exact: true }).tap();
    await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
    await expect(bar(page)).toHaveAttribute('data-exhibit', roomA.exhibits[0].id);
    await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).tap();
    await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
    await page.screenshot({ path: info.outputPath('guided-mobile.png') });
    const controls = await bar(page).boundingBox(), exit = await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).boundingBox();
    expect(controls!.y).toBeGreaterThan(exit!.y + exit!.height);
    await page.getByRole('button', { name: 'Di chuyển bằng joystick', exact: true }).tap();
    await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  });
});

test('late translated canvas label never strands a moving request', async ({ page }) => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/public/translations**', async route => {
    await gate;
    await fulfillMuseum(route, envelope({ 'ui.tour.canvas-aria': 'Translated gallery' }));
  });
  await open(page, false);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'moving');
  finish();
  await expect(page.getByLabel('Translated gallery', { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing', { timeout: 10_000 });
});

test('native fullscreen close and immediate reopen preserve explicit tour ownership', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
    await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
    await expect(bar(page)).toHaveAttribute('data-status', 'paused');
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
    await waitForRendererIdle(page);
    await expect(page.locator('canvas')).toHaveCount(1);
  }
});

test('Exit keeps the arrived pose and cancels automatic selection refocus', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  const arrived = await position(page);
  const orientation = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.quaternion.toArray());
  await page.getByRole('button', { name: 'Thoát hướng dẫn', exact: true }).click();
  await waitForRendererIdle(page);
  expect(await position(page)).toEqual(arrived);
  expect(await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.quaternion.toArray())).toEqual(orientation);
});

test('a reset command finishes in its DOM action before subsequent manual movement', async ({ page }) => {
  await open(page);
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await canvas.focus();
  await page.keyboard.down('d');
  await expect.poll(async () => (await position(page))[0]).toBeGreaterThan(0.3);
  await page.keyboard.up('d');
  await waitForRendererIdle(page);
  const reset = await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).evaluate(button => {
    button.click();
    return window.museumProbe.at(-1)!.camera!.deref()!.position.toArray();
  });
  expect(reset).toEqual([0, 2.6, 5.8]);
  await canvas.focus();
  await page.keyboard.down('Shift'); await page.keyboard.down('d');
  await expect.poll(async () => (await position(page))[0]).toBeGreaterThan(0.3);
  await page.keyboard.up('d'); await page.keyboard.up('Shift');
});

test('a replacement GLB clears an obsolete render failure for the same exhibit', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let fixtures!: Awaited<ReturnType<typeof installFiveModels>>;
  await open(page, true, 'sculpture', async () => { fixtures = await installFiveModels(page, { gate }); });
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.scene?.deref())).toBe(true);
  await page.evaluate(() => {
    const scene = window.museumProbe.at(-1)!.scene!.deref()!;
    const prototype = Object.getPrototypeOf(Object.getPrototypeOf(scene)) as Object3D;
    const clone = prototype.clone;
    prototype.clone = function(...args) {
      if (this.name === 'source-1') throw new Error('Controlled old GLB render failure');
      return clone.apply(this, args);
    };
  });
  release();
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-phase', 'blocked');
  const binary = createMuseumGlb('replacement');
  const checksum = createHash('sha256').update(binary).digest('hex');
  const exhibits = fixtures.exhibits.map((e, i) => i === 1 ? { ...e, model: { ...e.model, checksumSha256: checksum, sizeBytes: binary.length,
    url: `/rooms/sculpture/exhibits/${e.id}/model?version=${checksum}` } } : e);
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits })));
  await page.route(`**/model?version=${checksum}`, route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: binary,
    headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true' } }));
  await page.locator('details[data-catalogue] summary').click();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).last().click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(bar(page)).toHaveAttribute('data-phase', 'viewing');
  await expect(bar(page)).toHaveAttribute('data-exhibit', exhibits[1].id);
});
