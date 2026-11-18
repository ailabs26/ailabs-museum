import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';
import { museumHotspotButton, openMuseumHotspots, refreshMuseum, selectMuseumHotspot } from './fixtures/museumUi';
import { installRendererProbe, waitForRendererIdle } from './fixtures/museumProbe';
import { installXrSimulation } from './fixtures/museumXr';
import { installFiveModels } from './fixtures/museumGlb';
import { getGalleryColliders } from '../src/helpers/gallerySlots';
import { isNavigationSegmentSafe, NAVIGATION } from '../src/helpers/museumNavigation';
import { MUSEUM_ROOM_SIZE } from '../src/interfaces/museumScene';
import { mapRoomDisplays } from '../src/helpers/mapRoomDisplays';
import { roomDetailSchema } from '../src/validations/roomSchema';

const annotations = [
  { id: '30000000-0000-4000-8000-000000000003', displayOrder: 2, label: 'Kỹ thuật chế tác', body: 'Dấu vết của dụng cụ.', positionX: 0.5, positionY: 3.3, positionZ: 0.8 },
  { id: '30000000-0000-4000-8000-000000000002', displayOrder: 1, label: 'Chất liệu', body: 'Thớ gỗ còn nguyên.', positionX: 0, positionY: 3.3, positionZ: 0.8 },
  { id: '30000000-0000-4000-8000-000000000001', displayOrder: 1, label: 'Hoa văn', body: 'Đường khắc trên bề mặt.', positionX: -0.5, positionY: 3.3, positionZ: 0.8 },
];
const display = roomA.exhibits[0];
const chapter = (page: Page) => page.getByRole('region', { name: 'Khám phá chi tiết hiện vật', exact: true });
const markerButton = (page: Page, label: string) => museumHotspotButton(page, `Điểm tương tác ${display.name}: ${label}`);
const next = (page: Page) => chapter(page).getByRole('button', { name: 'Điểm tiếp theo' });
const previous = (page: Page) => chapter(page).getByRole('button', { name: 'Điểm trước' });
const navigation = (page: Page) => page.locator('[data-navigation-mode]');

async function setup(page: Page) {
  await installMuseumApi(page);
  await page.route('**/api/public/translations?*', route => fulfillMuseum(route, envelope({})));
  let hotspots = annotations;
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route,
    envelope({ ...roomA, exhibits: [{ ...display, hotspots }, ...roomA.exhibits.slice(1)] })));
  return (value: typeof annotations) => { hotspots = value; };
}

async function open(page: Page) {
  await page.goto('/tour.html?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
}

test('native selection opens the exact story and navigates CMS order, including ties and boundaries', async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await openMuseumHotspots(page);
  const pattern = markerButton(page, 'Hoa văn');
  const material = markerButton(page, 'Chất liệu');
  await page.locator('[data-hotspots] summary').focus();
  await page.keyboard.press('Tab');
  await expect(pattern).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(pattern).toBeFocused();
  await expect(pattern).toHaveAttribute('aria-pressed', 'true');
  await expect(material).toHaveAttribute('aria-pressed', 'false');
  await expect(chapter(page)).toContainText('Đường khắc trên bề mặt.');
  await expect(chapter(page)).not.toContainText('Thớ gỗ còn nguyên.');
  await expect(chapter(page)).toContainText('1/3');
  await expect(previous(page)).toBeDisabled();
  await next(page).focus();
  await page.keyboard.press('Space');
  await expect(chapter(page).getByRole('heading', { name: 'Chất liệu' })).toBeVisible();
  await expect(material).toHaveAttribute('aria-pressed', 'true');
  await next(page).click();
  await expect(chapter(page)).toContainText('Dấu vết của dụng cụ.');
  await expect(next(page)).toBeDisabled();
  await previous(page).click();
  await expect(chapter(page)).toContainText('Thớ gỗ còn nguyên.');
  await chapter(page).getByRole('button', { name: 'Thông tin hiện vật' }).click();
  await expect(chapter(page)).toHaveCount(0);
  await expect(pattern).toBeFocused();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(display.description);
  await expect(page).toHaveURL(new RegExp(`exhibit=${display.id}`));
});

test('a 3D click picks an exact ID and the latest rapid selection owns the camera', async ({ page }) => {
  await setup(page);
  await installRendererProbe(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  const bounds = (await canvas.boundingBox())!;
  const project = (id: string) => page.evaluate(hotspotId => {
    const { scene, camera } = window.museumProbe.at(-1) ?? {};
    const eye = camera?.deref();
    if (!eye) return;
    let point: number[] | undefined;
    scene?.deref()?.traverse(object => {
      if (object.userData.hotspotId === hotspotId) point = object.getWorldPosition(eye.position.clone()).project(eye).toArray();
    });
    return point;
  }, id);
  const [firstId, lastId] = [annotations[2].id, annotations[0].id];
  await expect.poll(() => project(firstId)).toBeDefined();
  const [x, y] = (await project(firstId))!;
  await page.mouse.move(bounds.x + (x + 1) * bounds.width / 2, bounds.y + (1 - y) * bounds.height / 2);
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  await expect(chapter(page)).toHaveCount(0);
  await page.mouse.down();
  await page.mouse.up();
  await expect(chapter(page)).toContainText(annotations[2].body);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openMuseumHotspots(page);
  const pick = (label: string) => markerButton(page, label).evaluate((button: HTMLButtonElement) => button.click());
  await pick('Chất liệu');
  await expect(navigation(page)).toHaveAttribute('data-navigation-mode', 'focusing');
  await pick('Hoa văn');
  await pick('Kỹ thuật chế tác');
  await expect(chapter(page)).toContainText(annotations[0].body);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(navigation(page)).toHaveAttribute('data-navigation-mode', 'inspect');
  const latestProjection = (await project(lastId))!;
  expect(latestProjection[0]).toBeCloseTo(0, 2);
  expect(latestProjection[1]).toBeCloseTo(0, 2);
  await expect(page.locator('[data-hotspots] button[aria-pressed="true"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => {
    const active: string[] = [];
    window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => {
      if (object.userData.hotspotActive) active.push(object.userData.hotspotId);
    });
    return active;
  })).toEqual([lastId]);
  expect(errors).toEqual([]);
});

test('refetch preserves the same hotspot with current copy, then clears removed content', async ({ page }) => {
  const setHotspots = await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await openMuseumHotspots(page);
  await markerButton(page, 'Hoa văn').click();
  await expect(chapter(page)).toContainText(annotations[2].body);
  setHotspots(annotations.map(item => item.id === annotations[2].id ? { ...item, body: 'Nội dung sau khi làm mới.' } : item));
  await refreshMuseum(page);
  await expect(chapter(page)).toContainText('Nội dung sau khi làm mới.');
  setHotspots(annotations.slice(0, 2));
  await refreshMuseum(page);
  await expect(chapter(page)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`exhibit=${display.id}`));
  await expect(page.locator('[data-hotspots] button[aria-pressed="true"]')).toHaveCount(0);
});

test('focus frames the selected marker along a safe route and returns to demand rendering', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 800, height: 600 });
  await setup(page);
  await installRendererProbe(page);
  await open(page);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
  await waitForRendererIdle(page);
  await page.evaluate(() => {
    const renderer = window.museumProbe.at(-1)!.renderer.deref()!;
    const original = renderer.render;
    const samples: number[][] = [];
    Reflect.set(window, 'storyCameraSamples', samples);
    renderer.render = function(scene, camera) {
      samples.push([...camera.position.toArray(), ...camera.quaternion.toArray()]);
      return original.call(this, scene, camera);
    };
  });
  await openMuseumHotspots(page);
  await markerButton(page, 'Chất liệu').click();
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'focusing');
  await expect(chapter(page)).toContainText(annotations[1].body);
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect', { timeout: 60_000 });
  await waitForRendererIdle(page);
  const samples = await page.evaluate(() => Reflect.get(window, 'storyCameraSamples') as number[][]);
  const projection = await page.evaluate(hotspotId => {
    const record = window.museumProbe.at(-1)!;
    const camera = record.camera!.deref()!;
    let point: number[] = [];
    record.scene!.deref()!.traverse(object => {
      if (object.userData.hotspotId === hotspotId) point = object.getWorldPosition(camera.position.clone()).project(camera).toArray();
    });
    return point;
  }, annotations[1].id);
  const evidence = info.outputPath('story-camera-samples.json');
  await writeFile(evidence, JSON.stringify({ samples, projection }));
  await info.attach('story-camera-samples', { contentType: 'application/json', path: evidence });
  const colliders = getGalleryColliders(mapRoomDisplays(roomDetailSchema.parse(roomA)));
  expect(samples.length).toBeGreaterThan(10);
  expect(Math.hypot(samples[0][0] - samples.at(-1)![0], samples[0][2] - samples.at(-1)![2])).toBeGreaterThan(0.3);
  for (let i = 1; i < samples.length; i++) {
    const [x, y, z, ...rotation] = samples[i];
    const [px, py, pz, ...priorRotation] = samples[i - 1];
    expect(y).toBeGreaterThanOrEqual(NAVIGATION.wallMargin);
    expect(y).toBeLessThanOrEqual(MUSEUM_ROOM_SIZE.height - NAVIGATION.wallMargin);
    expect(isNavigationSegmentSafe({ x: px, y: pz }, { x, y: z }, MUSEUM_ROOM_SIZE, colliders)).toBe(true);
    expect(Math.hypot(x - px, y - py, z - pz)).toBeLessThan(0.12);
    const dot = rotation.reduce((sum, value, axis) => sum + value * priorRotation[axis], 0);
    expect(2 * Math.acos(Math.min(1, Math.abs(dot)))).toBeLessThanOrEqual(0.06501);
  }
  expect(projection[0]).toBeCloseTo(0, 2);
  expect(projection[1]).toBeCloseTo(0, 2);
  expect(Math.abs(projection[2])).toBeLessThan(1);
});

test('a story pauses guided dwell and closing it leaves the same step paused', async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const guide = page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
  await page.clock.install();
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(guide).toHaveAttribute('data-phase', 'viewing');
  await openMuseumHotspots(page);
  await markerButton(page, 'Hoa văn').click();
  await expect(guide).toHaveAttribute('data-status', 'paused');
  await expect(chapter(page)).toContainText(annotations[2].body);
  await page.clock.fastForward(20_000);
  await expect(guide).toHaveAttribute('data-exhibit', display.id);
  await page.keyboard.press('Escape');
  await expect(chapter(page)).toHaveCount(0);
  await expect(guide).toHaveAttribute('data-status', 'paused');
  await expect(guide.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();
});

test('a hotspot takes over from a moving guide, and manual input cancels only the camera', async ({ page }) => {
  await setup(page);
  await installRendererProbe(page);
  await open(page);
  const guide = page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(guide).toHaveAttribute('data-phase', 'moving');
  await openMuseumHotspots(page);
  await markerButton(page, 'Chất liệu').click();
  await expect(guide).toHaveAttribute('data-status', 'paused');
  await expect(navigation(page)).toHaveAttribute('data-navigation-mode', 'focusing');
  await page.getByLabel('Phòng trưng bày 3D', { exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(navigation(page)).toHaveAttribute('data-navigation-mode', 'explore');
  await expect(chapter(page)).toContainText(annotations[1].body);
  await waitForRendererIdle(page);
  await expect(guide).toHaveAttribute('data-exhibit', display.id);
});

test('stories also work with a paused or completed guided tour', async ({ page }) => {
  await setup(page);
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route,
    envelope({ ...roomA, exhibits: [{ ...display, hotspots: annotations }] })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.clock.install();
  const guide = page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(guide).toHaveAttribute('data-phase', 'viewing');
  await guide.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await openMuseumHotspots(page);
  await markerButton(page, 'Hoa văn').click();
  await expect(chapter(page)).toContainText(annotations[2].body);
  await expect(guide).toHaveAttribute('data-status', 'paused');
  await page.locator('[data-hotspots] summary').click();
  await guide.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(chapter(page)).toHaveCount(0);
  await expect(guide).toHaveAttribute('data-phase', 'viewing');
  await page.clock.fastForward(20_000);
  await expect(guide).toHaveAttribute('data-status', 'completed');
  await openMuseumHotspots(page);
  await markerButton(page, 'Chất liệu').click();
  await expect(chapter(page)).toContainText(annotations[1].body);
  await expect(guide).toHaveAttribute('data-status', 'completed');
});

test('a failed GLB leaves readable stories and does not replace or reload healthy models', async ({ page }) => {
  await installMuseumApi(page);
  const { exhibits, requests } = await installFiveModels(page, { failIndex: 0, failure: 404 });
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route,
    envelope({ ...roomA, exhibits: exhibits.map((item, index) => index === 0 ? { ...item, hotspots: annotations } : item) })));
  await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible();
  const healthyIds = () => page.evaluate(() => {
    const uuids: string[] = [];
    window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => { if (object.userData.modelLoaded) uuids.push(object.uuid); });
    return uuids;
  });
  await expect.poll(healthyIds).toHaveLength(4);
  const before = await healthyIds();
  const camera = () => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray());
  const pose = await camera();
  await openMuseumHotspots(page);
  await markerButton(page, 'Hoa văn').click();
  await expect(chapter(page)).toContainText(annotations[2].body);
  await next(page).click();
  await expect(chapter(page)).toContainText(annotations[1].body);
  await waitForRendererIdle(page);
  expect(await camera()).toEqual(pose);
  expect(await healthyIds()).toEqual(before);
  expect(requests).toEqual([1, 1, 1, 1, 1]);
});

test('XR controller and gaze select exact stories and restore the web camera on exit', async ({ page }) => {
  test.slow();
  await setup(page);
  await installRendererProbe(page);
  await installXrSimulation(page);
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    const drawn: string[] = [];
    Reflect.set(window, 'xrStoryText', drawn);
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (this.canvas.width === 1024 && this.canvas.height === 768) drawn.push(args[0]);
      return fillText.apply(this, args);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const cameraPose = () => page.evaluate(() => {
    const camera = window.museumProbe.at(-1)?.camera?.deref();
    return camera && [...camera.position.toArray(), ...camera.quaternion.toArray()];
  });
  await expect.poll(cameraPose).toBeDefined();
  const saved = await cameraPose();
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.museumXrFixture.listeners.at(-1)?.select)).toBe(2);
  const origin = () => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.position.toArray());
  const xrOrigin = await origin();
  const markerPoint = (hotspotId: string) => page.evaluate(id => {
    const record = window.museumProbe.at(-1)!;
    const scene = record.scene!.deref()!, camera = record.camera!.deref()!;
    let point: number[] | undefined;
    scene.traverse(object => {
      if (object.userData.hotspotId === id) point = object.getWorldPosition(camera.position.clone()).toArray();
    });
    return point;
  }, hotspotId);
  const reticleDistance = (point: number[]) => page.evaluate(target => {
    const scene = window.museumProbe.at(-1)!.scene!.deref()!;
    let distance = Infinity;
    scene.traverse(object => {
      if (!object.parent?.userData.xrIgnore || !object.visible || !('isMesh' in object)) return;
      distance = Math.min(distance, object.position.distanceTo(object.position.clone().fromArray(target)));
    });
    return distance;
  }, point);
  const aimAtMarker = (point: number[], input: 'ray' | 'head') => page.evaluate(({ point, input }) => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    const origin = camera.parent!;
    const target = camera.position.clone().fromArray(point);
    // Approach the exhibit so the in-headset panel at spawn cannot intercept the ray.
    const start = origin.worldToLocal(target.clone().setY(input === 'head' ? 1.7 : 1.3).setZ(target.z + 2));
    origin.worldToLocal(target);
    window.museumXrFixture[input] = camera.matrix.clone().lookAt(start, target, camera.up).setPosition(start).toArray();
    if (input === 'head') window.museumXrFixture.disconnect();
  }, { point, input });
  const controllerPoint = (await markerPoint(annotations[2].id))!;
  await aimAtMarker(controllerPoint, 'ray');
  await expect.poll(() => reticleDistance(controllerPoint)).toBeLessThan(0.2);
  await page.evaluate(() => window.museumXrFixture.select());
  await expect(chapter(page)).toContainText(annotations[2].body);
  const drawn = () => page.evaluate(() => Reflect.get(window, 'xrStoryText') as string[]);
  await expect.poll(drawn).toContain(annotations[2].body);
  expect(await drawn()).not.toContain(annotations[1].body);
  const gazePoint = (await markerPoint(annotations[0].id))!;
  await aimAtMarker(gazePoint, 'head');
  await expect.poll(() => reticleDistance(gazePoint)).toBeLessThan(0.2);
  await expect(chapter(page)).toContainText(annotations[0].body, { timeout: 12_000 });
  await expect.poll(drawn).toContain(annotations[0].body);
  expect(await origin()).toEqual(xrOrigin);
  await page.evaluate(() => window.museumXrFixture.session!.end());
  await expect(page.locator('[data-xr-phase="idle"]')).toBeVisible();
  await expect(chapter(page)).toHaveCount(0);
  await expect.poll(cameraPose).toEqual(saved);
});

test('WebGL loss leaves the chapter readable in the 2D tour view and a room change clears it', async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await openMuseumHotspots(page);
  await markerButton(page, 'Hoa văn').click();
  await expect(chapter(page)).toBeVisible();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await canvas.evaluate((node: HTMLCanvasElement) => node.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.locator('[data-webgl-status]')).toHaveAttribute('data-webgl-status', 'recovering');
  await expect(chapter(page)).toContainText(annotations[2].body);
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D', exact: true })).toBeVisible({ timeout: 18_000 });
  await expect(canvas).toHaveCount(0);
  await expect(chapter(page)).toContainText(annotations[2].body);
  await expect(page).toHaveURL(new RegExp(`exhibit=${display.id}`));
  await page.getByLabel('Chọn phòng trưng bày', { exact: true }).selectOption('ceramics');
  await expect(chapter(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Gốm Việt', exact: true })).toBeVisible();
});

test('selecting a fallback marker clears the real story and keeps ordinary exhibit details', async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await openMuseumHotspots(page);
  await markerButton(page, 'Hoa văn').click();
  await expect(chapter(page)).toBeVisible();
  await selectMuseumHotspot(page, 'Điểm tương tác Hiện vật 2');
  await expect(chapter(page)).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(roomA.exhibits[1].description);
  await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
  await expect(page.locator('[data-immersive-tour]')).toHaveCount(0);
  await expect(chapter(page)).toHaveCount(0);
});

test.describe('touch layout', () => {
  test.use({ hasTouch: true });
  test('story fits mobile, tablet and desktop without covering the joystick or immersive exit', async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.locator('[data-hotspots] summary').tap();
    await markerButton(page, 'Hoa văn').tap();
    await expect(chapter(page)).toContainText(annotations[2].body);
    await page.locator('[data-hotspots] summary').tap();
    const exit = page.getByRole('button', { name: 'Thoát tham quan', exact: true });
    const joystick = page.getByRole('button', { name: 'Di chuyển bằng joystick', exact: true });
    for (const [width, height] of [[390, 844], [768, 1024], [1280, 720]]) {
      await page.setViewportSize({ width, height });
      const detail = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
      const bounds = (await detail.boundingBox())!;
      const isDirectlyHittable = (node: HTMLElement) => {
        const bounds = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      };
      await expect.poll(() => joystick.evaluate(isDirectlyHittable)).toBe(true);
      await expect.poll(() => exit.evaluate(isDirectlyHittable)).toBe(true);
      await expect.poll(() => next(page).evaluate(isDirectlyHittable)).toBe(true);
      await expect.poll(() => previous(page).evaluate(isDirectlyHittable)).toBe(true);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      expect(await next(page).evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: info.outputPath(`story-${width}x${height}.png`) });
    }
    await next(page).tap();
    await expect(chapter(page)).toContainText(annotations[1].body);
    await exit.tap();
    await expect(page.locator('[data-immersive-tour]')).toHaveCount(0);
  });
});
