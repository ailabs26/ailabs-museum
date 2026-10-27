import { museumExhibitButton, refreshMuseum, selectMuseumExhibit } from './fixtures/museumUi';
import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';
import { PerspectiveCamera, Vector3 } from 'three';
import { installRendererProbe, waitForGallerySurfaces, waitForRendererIdle } from './fixtures/museumProbe';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('short mobile viewport keeps the gallery and touch controls at the intended height', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  expect((await page.locator('[class*="_viewport_"]').boundingBox())!.height).toBeGreaterThanOrEqual(440);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('keyboard catalogue selection has one pressed item and clears on room change', async ({ page }) => {
  await page.goto('/tour');
  const first = museumExhibitButton(page, 'Xem chi tiết Hiện vật 1');
  await first.focus();
  await first.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  const second = museumExhibitButton(page, 'Xem chi tiết Hiện vật 2');
  await second.press('Space');
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(museumExhibitButton(page, 'Xem chi tiết Bình gốm')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('detail uses published text, stays nonmodal and Escape restores its trigger', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{
    ...roomA.exhibits[0], description: '<b>Thông tin được duyệt</b>', transcript: 'Thuyết minh đã xuất bản',
    hotspots: [{ id: '20000000-0000-4000-8000-000000000001', label: 'Bề mặt', body: 'Dấu khắc gốc', positionX: 0, positionY: 1, positionZ: 0, displayOrder: 0 }],
  }] })));
  await page.goto('/tour');
  const trigger = museumExhibitButton(page, 'Xem chi tiết Hiện vật 1');
  await trigger.click();
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('<b>Thông tin được duyệt</b>', { exact: true })).toBeVisible();
  await expect(panel.locator('b')).toHaveCount(0);
  await expect(panel.getByText('Thuyết minh đã xuất bản')).toBeVisible();
  await expect(panel.getByText('Dấu khắc gốc')).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('room changes and failed refresh remove selected details', async ({ page }) => {
  await page.goto('/tour');
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 1');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await selectMuseumExhibit(page, 'Xem chi tiết Bình gốm');
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await refreshMuseum(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('real scene picking selects the plinth and hover gives pointer feedback', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.64);
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.64);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Hiện vật 1');
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 1')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
  await expect(canvas).toBeFocused();
});

test('selecting an exhibit focuses the camera and reset retains published detail', async ({ page }) => {
  await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  const initialFrames = await page.evaluate(() => window.museumProbe.at(-1)?.frames ?? 0);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel).toContainText('Hiện vật 2');
  // Detail DOM can appear before the focus effect and its demand frame finish.
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
  await expect.poll(() => page.evaluate(() => window.museumProbe.at(-1)?.frames ?? 0)).toBeGreaterThan(initialFrames);
  const capture = { style: 'canvas { outline: none !important; } [aria-label="Điều khiển góc nhìn"], [data-navigation-mode] { visibility: hidden !important; }' };
  const readCamera = () => page.evaluate(() => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    return { position: camera.position.toArray(), rotation: camera.quaternion.toArray(), aspect: (camera as unknown as { aspect: number }).aspect };
  });
  const focused = await canvas.screenshot(capture);
  const focusedCamera = await readCamera();
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(false);
  await expect(panel).toContainText('Mô tả hiện vật 2');
  const reset = await canvas.screenshot(capture);
  await expect(page.getByRole('button', { name: 'Tập trung hiện vật', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tập trung hiện vật', exact: true }).click();
  await expect.poll(readCamera).toEqual(focusedCamera);
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(true);
  await canvas.press('ArrowLeft');
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(false);
  await canvas.press('f');
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(true);
  expect(focused.equals(reset)).toBe(false);
});

test('outside-room exhibits retain detail but cannot focus the camera outside the gallery', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{ ...roomA.exhibits[0], positionX: 20 }] })));
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 1');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('ngoài phạm vi');
  await expect(page.getByRole('button', { name: 'Tập trung hiện vật', exact: true })).toBeDisabled();
});

test('narrow screens keep controls and detail over the fullscreen scene', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  const frame = (await canvas.boundingBox())!;
  const toolbar = page.getByLabel('Điều khiển góc nhìn');
  const toolbarBox = (await toolbar.boundingBox())!;
  expect(toolbarBox.y).toBeGreaterThanOrEqual(frame.y);
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(frame.y + frame.height);
  for (const button of await toolbar.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 1');
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  const panelBox = (await panel.boundingBox())!;
  const selectedFrame = (await canvas.boundingBox())!;
  expect(selectedFrame).toEqual(frame);
  expect(panelBox.y).toBeGreaterThan(selectedFrame.y);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(selectedFrame.y + selectedFrame.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('day3-mobile-detail.png'), fullPage: true });
  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
  // Reflow with doubled text size; this is not a physical-device/native zoom claim.
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dragging a display navigates without selecting it', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.64);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.64, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('focus settles, manual input cancels motion and unmount stays usable', async ({ page }) => {
  await installRendererProbe(page);
  await page.addInitScript(() => {
    Reflect.set(window, '__museumDraws', 0);
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args: Parameters<typeof draw>) {
      Reflect.set(window, '__museumDraws', Reflect.get(window, '__museumDraws') + 1);
      return draw.apply(this, args);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  await waitForGallerySurfaces(page);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
  await waitForRendererIdle(page);
  const settled = await page.evaluate(() => Reflect.get(window, '__museumDraws'));
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => Reflect.get(window, '__museumDraws'))).toBe(settled);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 3');
  await canvas.press('ArrowLeft');
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'explore');
  await waitForRendererIdle(page);
  const cancelled = await page.evaluate(() => Reflect.get(window, '__museumDraws'));
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => Reflect.get(window, '__museumDraws'))).toBe(cancelled);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 4');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  expect(errors).toEqual([]);
});

test.describe('touch interaction', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('a real touch tap selects the display and mobile detail remains readable', async ({ page }, testInfo) => {
    await page.goto('/tour');
    await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    const canvas = page.getByLabel('Phòng trưng bày 3D');
    await expect(canvas).toBeVisible();
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.64);
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Mô tả hiện vật 1');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('day3-touch-detail.png'), fullPage: true });
  });
});

test('desktop detail leaves the scene visible and long published text wraps', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{
    ...roomA.exhibits[0], name: 'Hiện vật có tên dài '.repeat(9), description: 'Mô tả đã xuất bản '.repeat(80), transcript: 'Thuyết minh '.repeat(160),
  }, ...roomA.exhibits.slice(1)] })));
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  // Cold production imports and software WebGL can take longer than 5 seconds.
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await page.getByText('Danh mục hiện vật', { exact: true }).click();
  await page.getByRole('list', { name: 'Các hiện vật' }).getByRole('button').first().click();
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel).toBeVisible();
  // Detail overlays the scene without changing Canvas dimensions.
  await expect(async () => {
    const sceneBox = (await canvas.boundingBox())!;
    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.x).toBeGreaterThan(sceneBox.x);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(sceneBox.x + sceneBox.width);
    expect(sceneBox.width).toBeGreaterThan(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }).toPass({ timeout: 5_000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('day3-desktop-detail.png'), fullPage: true });
});

test('selecting a lower catalogue card reveals focused detail and closing reveals the trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/tour');
  const trigger = museumExhibitButton(page, 'Xem chi tiết Hiện vật 5');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.press('Enter');
  const heading = page.getByRole('complementary', { name: 'Chi tiết hiện vật' }).getByRole('heading', { name: 'Hiện vật 5', exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toBeInViewport();
});

test('automatic dark scheme preserves contrast in the tour and warm detail surfaces', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/tour');
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
  const contrast = (element: HTMLElement) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
        const unit = value / 255;
        return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    let surface: HTMLElement | null = element;
    while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
    const foreground = luminance(getComputedStyle(element).color);
    const background = luminance(surface ? getComputedStyle(surface).backgroundColor : 'rgb(255, 255, 255)');
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  };
  expect(await page.getByRole('heading', { level: 1 }).evaluate(contrast)).toBeGreaterThanOrEqual(4.5);
  expect(await page.getByRole('heading', { name: 'Bước vào phòng trưng bày' }).evaluate(contrast)).toBeGreaterThanOrEqual(4.5);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 1');
  expect(await page.getByRole('complementary', { name: 'Chi tiết hiện vật' }).getByRole('heading', { name: 'Hiện vật 1', exact: true }).evaluate(contrast)).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('day3-dark-detail.png'), fullPage: true });
});

test('clicking a visible annotation selects its exhibit above nearer geometry', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [
    { ...roomA.exhibits[0], placeholderShape: 'sphere', positionX: 0, positionZ: 0 },
    { ...roomA.exhibits[1], placeholderShape: 'sphere', positionX: 0, positionZ: -2 },
  ] })));
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const camera = new PerspectiveCamera(60, box.width / box.height, 0.1, 40);
  camera.position.set(0, 2.6, 5.8);
  camera.lookAt(0, 1.35, 0);
  camera.updateMatrixWorld();
  const plaqueCentre = new Vector3(0, 0.78, -1.25).project(camera);
  await page.mouse.click(box.x + (plaqueCentre.x + 1) * box.width / 2, box.y + (1 - plaqueCentre.y) * box.height / 2);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' }).getByRole('heading', { name: 'Hiện vật 2', exact: true })).toBeVisible();
});
