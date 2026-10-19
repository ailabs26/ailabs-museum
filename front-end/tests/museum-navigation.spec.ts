import { expect, test, type Page } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';
import { installFiveModels } from './fixtures/museumGlb';

// Local cold chunk transfer was measured at 18.9s; keep gesture assertions
// strict while allowing the scene to finish loading before measuring controls.
test.setTimeout(60_000);

async function cameraState(page: Page) {
  return page.evaluate(() => {
    const camera = window.museumProbe.at(-1)?.camera?.deref();
    return camera ? { position: camera.position.toArray(), rotation: camera.quaternion.toArray() } : null;
  });
}
async function openTour(page: Page) {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => cameraState(page)).not.toBeNull();
  return canvas;
}

test('WASD walks, Shift sprints, focus loss stops input and idle rendering sleeps', async ({ page }) => {
  const canvas = await openTour(page); await canvas.focus();
  const before = (await cameraState(page))!.position;
  await page.keyboard.down('w'); await page.waitForTimeout(450); await page.keyboard.up('w');
  await expect.poll(async () => (await cameraState(page))!.position[2]).toBeLessThan(before[2] - 0.3);
  const after = (await cameraState(page))!;
  expect(Math.abs(after.position[0] - before[0])).toBeLessThan(0.02);
  await page.waitForTimeout(900);
  const frames = (await readRendererProbe(page)).at(-1)!.frames;
  await page.waitForTimeout(300); expect((await readRendererProbe(page)).at(-1)!.frames).toBe(frames);
  await page.keyboard.down('d'); await page.waitForTimeout(100);
  await page.getByLabel('Chọn phòng trưng bày').focus(); await page.keyboard.up('d');
  const stopped = await cameraState(page); await page.waitForTimeout(200);
  expect(await cameraState(page)).toEqual(stopped);
  await page.keyboard.press('w'); expect(await cameraState(page)).toEqual(stopped);
});

test('drag look changes orientation without selecting, returning drag stays rejected, tap still works', async ({ page }, testInfo) => {
  const canvas = await openTour(page); const before = await cameraState(page);
  const box = (await canvas.boundingBox())!, x = box.x + box.width * 0.65, y = box.y + box.height * 0.5;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 70, y - 30, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await cameraState(page))!.rotation).not.toEqual(before!.rotation);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 70, y, { steps: 6 }); await page.mouse.move(x, y, { steps: 6 }); await page.mouse.up();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('navigation-desktop.png'), fullPage: true });
});

test('walking cannot pass through the central plinth; manual movement interrupts focus and reset recovers', async ({ page }) => {
  const canvas = await openTour(page); await canvas.focus();
  await page.keyboard.down('w'); await page.waitForTimeout(2600); await page.keyboard.up('w');
  expect((await cameraState(page))!.position[2]).toBeGreaterThan(1.45);
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
  await canvas.focus(); await page.keyboard.down('d'); await page.waitForTimeout(200); await page.keyboard.up('d');
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'explore');
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  await expect.poll(async () => (await cameraState(page))!.position).toEqual([0, 2.6, 5.8]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('Shift increases walking speed; narrow mouse viewport never shows a joystick', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = await openTour(page); await expect(page.getByRole('button', { name: 'Di chuyển bằng joystick' })).toHaveCount(0);
  await canvas.focus(); await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d');
  const walking = (await cameraState(page))!.position[0];
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click(); await canvas.focus();
  await page.keyboard.down('Shift'); await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d'); await page.keyboard.up('Shift');
  expect((await cameraState(page))!.position[0]).toBeGreaterThan(walking * 1.35);
  await page.getByRole('button', { name: 'Ẩn hướng dẫn' }).click();
  await expect(page.locator('#navigation-instructions')).toHaveCount(0);
});

test('neutral viewport resize preserves focus instead of turning it into manual exploration', async ({ page }) => {
  await openTour(page);
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
  await page.setViewportSize({ width: 700, height: 950 });
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
});

test('reduced-motion focus completes without waiting for a future render frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await openTour(page);
  await page.waitForTimeout(200); // Let initial demand frames settle before freezing RAF.
  const before = await cameraState(page);
  await page.evaluate(() => {
    Reflect.set(window, '__navigationRaf', window.requestAnimationFrame);
    window.requestAnimationFrame = () => 0;
  });
  try {
    // Direct DOM clicks deliberately avoid Playwright's RAF-based stability
    // wait: this test proves focus does not depend on the next renderer frame.
    await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).evaluate(button => button.click());
    await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
    const focused = await cameraState(page); expect(focused!.position).not.toEqual(before!.position);
    await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).evaluate(button => button.click());
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
    expect(await cameraState(page)).toEqual(focused);
  } finally {
    await page.evaluate(() => { window.requestAnimationFrame = Reflect.get(window, '__navigationRaf'); });
  }
});

test('a selected delayed GLB still reframes after resize and remains fully visible in portrait', async ({ page }) => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const { exhibits } = await installFiveModels(page, { gate }); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
  await page.setViewportSize({ width: 390, height: 844 });
  const before = (await cameraState(page))!.position; finish();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
  await expect.poll(async () => (await cameraState(page))!.position).not.toEqual(before);
  const extent = await page.evaluate(id => {
    const record = window.museumProbe.at(-1)!, scene = record.scene!.deref()!, camera = record.camera!.deref()!;
    let extent = 0; scene.updateMatrixWorld(true);
    scene.traverse(root => {
      if (!root.userData.modelLoaded || root.userData.artifactId !== id) return;
      const size = root.userData.normalization.size as number[];
      for (const x of [-size[0] / 2, size[0] / 2]) for (const y of [0, size[1]]) for (const z of [-size[2] / 2, size[2] / 2]) {
        const point = root.localToWorld(root.position.clone().set(x, y, z)).project(camera);
        extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
      }
    }); return extent;
  }, exhibits[0].id);
  expect(extent).toBeGreaterThan(0); expect(extent).toBeLessThan(1);
});

test.describe('touch exploration', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('analog joystick and look work simultaneously, release/cancel stops, UI does not rotate camera', async ({ page, context }, testInfo) => {
    const canvas = await openTour(page); await canvas.scrollIntoViewIfNeeded();
    const joystick = page.getByRole('button', { name: 'Di chuyển bằng joystick' });
    await expect(joystick).toBeVisible();
    const j = (await joystick.boundingBox())!, c = (await canvas.boundingBox())!;
    const session = await context.newCDPSession(page);
    const left = { id: 1, x: j.x + j.width / 2, y: j.y + j.height / 2 };
    const right = { id: 2, x: c.x + c.width * 0.8, y: c.y + c.height * 0.4 };
    const before = (await cameraState(page))!;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...left, y: left.y - 35 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...left, y: left.y - 35 }, right] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...left, y: left.y - 35 }, { ...right, x: right.x + 40, y: right.y - 20 }] });
    await page.waitForTimeout(400);
    const during = (await cameraState(page))!;
    expect(during.position[2]).toBeLessThan(before.position[2] - 0.15);
    expect(during.rotation).not.toEqual(before.rotation);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForTimeout(900); const stopped = await cameraState(page); await page.waitForTimeout(200);
    expect(await cameraState(page)).toEqual(stopped);
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
    await expect(joystick).toHaveAttribute('aria-pressed', 'false');
    await page.screenshot({ path: testInfo.outputPath('navigation-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Ẩn hướng dẫn' }).tap();
    await expect(page.locator('#navigation-instructions')).toHaveCount(0);
    expect(await cameraState(page)).toEqual(stopped);
    await session.detach();
  });
  for (const releaseFirst of ['joystick', 'look']) test(`multitouch release ${releaseFirst} keeps the other pointer independent`, async ({ page, context }) => {
    const canvas = await openTour(page); await canvas.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      Reflect.set(window, '__navigationReleased', []);
      window.addEventListener('pointerup', event => {
        (Reflect.get(window, '__navigationReleased') as unknown[]).push((event.target as Element)?.getAttribute('aria-label'));
      }, { once: true, capture: true });
    });
    const joystick = page.getByRole('button', { name: 'Di chuyển bằng joystick' });
    const j = (await joystick.boundingBox())!, c = (await canvas.boundingBox())!;
    const session = await context.newCDPSession(page);
    const left = { id: 1, x: j.x + j.width / 2, y: j.y + j.height / 2 }, movedLeft = { ...left, y: left.y - 35 };
    const right = { id: 2, x: c.x + c.width * 0.75, y: c.y + c.height * 0.4 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [movedLeft] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [movedLeft, right] });
    // CDP emits pointerup for the supplied point on a partial touchEnd.
    // Verify the released target so emulation cannot silently swap this case.
    const released = releaseFirst === 'joystick' ? movedLeft : right;
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [released] });
    expect(await page.evaluate(() => Reflect.get(window, '__navigationReleased'))).toEqual([releaseFirst === 'joystick' ? 'Di chuyển bằng joystick' : 'Phòng trưng bày 3D']);
    const before = (await cameraState(page))!;
    if (releaseFirst === 'joystick') {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...right, x: right.x + 35 }] });
      await expect.poll(async () => (await cameraState(page))!.rotation).not.toEqual(before.rotation);
    } else {
      await page.waitForTimeout(300);
      expect((await cameraState(page))!.position[2]).toBeLessThan(before.position[2] - 0.1);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(900); const stopped = await cameraState(page); await page.waitForTimeout(200);
    expect(await cameraState(page)).toEqual(stopped);
    await expect(joystick).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
    await session.detach();
  });
});
