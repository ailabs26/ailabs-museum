import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';
import { installRendererProbe, waitForRendererIdle } from './fixtures/museumProbe';
import { installXrSimulation } from './fixtures/museumXr';
import { installFiveModels } from './fixtures/museumGlb';
import { selectMuseumExhibit } from './fixtures/museumUi';
import { mapRoomDisplays } from '../src/helpers/mapRoomDisplays';
import { roomDetailSchema } from '../src/validations/roomSchema';
import { getGalleryColliders } from '../src/helpers/gallerySlots';
import { isNavigationSegmentSafe } from '../src/helpers/museumNavigation';
import { MUSEUM_ROOM_SIZE } from '../src/interfaces/museumScene';

test.setTimeout(90_000);
const panel = (page: Page) => page.getByRole('region', { name: 'Tìm trong phòng', exact: true });
const input = (page: Page) => page.getByRole('textbox', { name: 'Tìm hiện vật trong phòng', exact: true });
const results = (page: Page) => panel(page).getByRole('list', { name: 'Kết quả tìm kiếm' });
const go = (page: Page, index = 0) => results(page).getByRole('button', { name: 'Đi tới hiện vật', exact: true }).nth(index);
const position = (page: Page) => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray());
const status = (page: Page) => page.locator('[data-search-phase]');
const tour = (page: Page) => page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
async function open(page: Page, reduced = true) {
  await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto('/tour.html?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
}

test('E01–04 Vietnamese ranking is local, highlights actual scene and minimap, clear resets matches', async ({ page }) => {
  await installMuseumApi(page);
  const exhibits = roomA.exhibits.map((e, i) => ({ ...e, name: i === 2 ? 'Trống đồng' : e.name,
    description: i === 0 ? 'Trống đồng Việt Nam' : e.description }));
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits })));
  const searches: string[] = [];
  page.on('request', request => { if (request.url().includes('/rooms/search')) searches.push(request.url()); });
  await open(page); await input(page).fill(' TRONG   DONG ');
  await expect(results(page).getByRole('heading')).toHaveText(['Trống đồng', 'Hiện vật 1']);
  await expect(page.locator('[data-search-match="true"]')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => {
    let count = 0;
    window.museumProbe.at(-1)!.scene!.deref()!.traverse(object => { if (object.userData.searchMatch) count++; });
    return count;
  })).toBe(2);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click();
  await expect(page.locator('[data-search-match="true"]')).toHaveCount(0);
  await input(page).fill('khong ton tai');
  await expect(panel(page)).toContainText('Không tìm thấy hiện vật');
  expect(searches).toEqual([]);
});

test('E05/E07 repeated target after manual movement issues a new route and selects only at arrival', async ({ page }) => {
  await installMuseumApi(page); await open(page);
  await input(page).fill('Hiện vật 2'); const before = await position(page);
  await go(page).click(); await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  expect(await position(page)).not.toEqual(before);
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[1].id}`));
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Hiện vật 2');
  await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  await go(page).click(); await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  expect(await position(page)).not.toEqual([0, 2.6, 5.8]);
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click();
  await expect(page.locator('[data-search-target="true"]')).toHaveCount(0);
});

test('a previously auto-focused selection cannot cancel a new search route', async ({ page }) => {
  await installMuseumApi(page); await open(page);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 1');
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'inspect');
  await input(page).fill('Hiện vật 2'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[1].id}`));
});

test('search arrival detail link follows its exhibit while the paused guided tour retains its step', async ({ page }) => {
  await installMuseumApi(page); await open(page);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(tour(page)).toHaveAttribute('data-phase', 'viewing');
  await input(page).fill('Hiện vật 2'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  await expect(tour(page)).toHaveAttribute('data-exhibit', roomA.exhibits[0].id);
  const link = page.getByRole('complementary', { name: 'Chi tiết hiện vật' }).getByRole('link', { name: 'Đọc chi tiết 2D', exact: true });
  await expect(link).toHaveAttribute('href', new RegExp(roomA.exhibits[1].id));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/collection/sculpture/exhibits/${roomA.exhibits[1].id}`));
});

test('collapsed wayfinding controls leave the visible canvas draggable below them', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installMuseumApi(page); await open(page);
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  expect(await page.evaluate(() => document.elementFromPoint(100, 550)?.tagName)).toBe('CANVAS');
  const before = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.quaternion.toArray());
  await page.mouse.move(100, 550); await page.mouse.down(); await page.mouse.move(155, 560, { steps: 5 }); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.quaternion.toArray())).not.toEqual(before);
});

test('search cannot issue navigation before the actual camera owner mounts', async ({ page }) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.addInitScript(() => {
    const NativeObserver = ResizeObserver;
    let held = true;
    const queued: (() => void)[] = [];
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => { if (held) queued.push(() => callback(entries, observer)); else callback(entries, observer); });
      }
    };
    Reflect.set(window, 'releaseSearchResize', () => { held = false; queued.splice(0).forEach(callback => callback()); });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour.html?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.locator('[data-webgl-status]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm trong phòng', exact: true })).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, 'releaseSearchResize')());
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  await input(page).fill('Hiện vật 2'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
});

test('a parsed GLB render failure frames the visible fallback instead of the absent model', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await installFiveModels(page, { gate }); await open(page);
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.scene?.deref())).toBe(true);
  await page.evaluate(() => {
    const scene = window.museumProbe.at(-1)!.scene!.deref()!;
    const prototype = Object.getPrototypeOf(Object.getPrototypeOf(scene)) as import('three').Object3D;
    const clone = prototype.clone;
    prototype.clone = function(...args) {
      if (this.name === 'source-1') throw new Error('Controlled search render failure');
      return clone.apply(this, args);
    };
  });
  release();
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await input(page).fill('Hiện vật 2'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  const alignment = await page.evaluate(() => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    const toFallback = camera.position.clone().set(0, 1.64, -2).sub(camera.position).normalize();
    return camera.getWorldDirection(camera.position.clone()).dot(toFallback);
  });
  expect(alignment).toBeGreaterThan(0.999);
});

test('E06/E07 safe real trajectory detours central collider and latest explicit target wins', async ({ page }, info) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 }));
  await installMuseumApi(page);
  const detourRoom = { ...roomA, exhibits: roomA.exhibits.map((e, i) => i === 1 ? { ...e, positionX: 0 } : e) };
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope(detourRoom)));
  await open(page, false); await waitForRendererIdle(page);
  await page.evaluate(() => {
    const renderer = window.museumProbe.at(-1)!.renderer.deref()!, render = renderer.render;
    Reflect.set(window, 'searchSamples', []);
    renderer.render = function(scene, camera) {
      (Reflect.get(window, 'searchSamples') as number[][]).push(camera.position.toArray());
      return render.call(this, scene, camera);
    };
  });
  await input(page).fill('Hiện vật 3'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'moving');
  await input(page).fill('Hiện vật 2'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived', { timeout: 70_000 });
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[1].id}`));
  const samples = await page.evaluate(() => Reflect.get(window, 'searchSamples') as number[][]);
  expect(samples.length).toBeGreaterThan(10);
  const colliders = getGalleryColliders(mapRoomDisplays(roomDetailSchema.parse(detourRoom)));
  const [lastX, , lastZ] = samples.at(-1)!;
  expect(isNavigationSegmentSafe({ x: 0, y: 5.8 }, { x: lastX, y: lastZ }, MUSEUM_ROOM_SIZE, colliders)).toBe(false);
  for (let i = 1; i < samples.length; i++) {
    expect(isNavigationSegmentSafe({ x: samples[i - 1][0], y: samples[i - 1][2] },
      { x: samples[i][0], y: samples[i][2] }, MUSEUM_ROOM_SIZE, colliders)).toBe(true);
  }
  expect(samples.some(([x, , z]) => Math.abs(x) > 1.47 && Math.abs(z) < 1.47)).toBe(true);
  const alignment = await page.evaluate(() => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    return camera.getWorldDirection(camera.position.clone()).dot(camera.position.clone().set(0, 1.73, -5.1).sub(camera.position).normalize());
  });
  expect(alignment).toBeGreaterThan(0.999);
  await info.attach('search-trajectory.json', { body: JSON.stringify(samples), contentType: 'application/json' });
  const searchBox = (await panel(page).boundingBox())!, detailBox = (await page.getByRole('complementary', { name: 'Chi tiết hiện vật' }).boundingBox())!;
  expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(detailBox.x);
  await expect(panel(page).getByRole('button', { name: 'Tìm trong phòng', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('search-arrived-desktop.png') });
});

test('E08 typing leaves tour running; navigation pauses dwell and explicit Resume takes over', async ({ page }) => {
  await installMuseumApi(page); await open(page);
  await page.getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).click();
  await expect(tour(page)).toHaveAttribute('data-phase', 'viewing');
  await input(page).fill('Hiện vật 3');
  await expect(tour(page)).toHaveAttribute('data-status', 'running');
  await go(page).click(); await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  await expect(tour(page)).toHaveAttribute('data-status', 'paused');
  await page.clock.install(); await page.clock.runFor(20_000);
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[2].id}`));
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).evaluate(button => button.click());
  await page.clock.runFor(100);
  await expect(tour(page)).toHaveAttribute('data-phase', 'viewing');
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[0].id}`));
});

test('E10 input focus clears held WASD; Enter navigates and Escape closes only search', async ({ page }) => {
  await installMuseumApi(page); await open(page);
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await canvas.focus(); await page.keyboard.down('d');
  await input(page).focus(); const stopped = await position(page); await page.keyboard.up('d');
  await input(page).fill('wasd'); await page.keyboard.press('w');
  await waitForRendererIdle(page); expect(await position(page)).toEqual(stopped);
  await input(page).fill('Hiện vật 2'); await page.keyboard.press('Enter');
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  await canvas.focus();
  await page.keyboard.press('Escape'); await expect(input(page)).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  await expect(page.locator('[data-immersive-tour]')).toBeVisible();
});

test('E12/E13 blocked route leaves pose/selection intact and offers 2D; outside-room is readable', async ({ page }) => {
  await installMuseumApi(page);
  // Published overlapping plinths leave no unoccluded viewing destination for this exhibit.
  const exhibits = roomA.exhibits.map((e, i) => ({ ...e, positionX: i === 4 ? 40 : 0, positionZ: 0, placeholderShape: 'torus' }));
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits })));
  await open(page); await input(page).fill('Hiện vật 5');
  await expect(go(page)).toBeDisabled(); await expect(results(page).getByRole('link')).toHaveAttribute('href', /collection\/sculpture\/exhibits/);
  await input(page).fill('Hiện vật 1'); const before = await position(page);
  await go(page).click(); await expect(status(page)).toHaveAttribute('data-search-phase', 'blocked');
  expect(await position(page)).toEqual(before);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('E09 hotspot takes over a moving search; new search clears the previous story', async ({ page }) => {
  await installMuseumApi(page);
  const hotspot = { id: '30000000-0000-4000-8000-000000000001', label: 'Hoa văn', body: 'Đường khắc trên bề mặt.',
    positionX: 0, positionY: 2.4, positionZ: 0.8, displayOrder: 0 };
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA,
    exhibits: roomA.exhibits.map((e, i) => i === 0 ? { ...e, hotspots: [hotspot] } : e) })));
  await open(page, false); await input(page).fill('Hiện vật 2'); await go(page).click();
  await page.locator('details[data-hotspots] summary').click();
  await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 1: Hoa văn', exact: true }).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'cancelled');
  await expect(input(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Khám phá chi tiết hiện vật', exact: true })).toContainText('Hoa văn');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  await input(page).fill('Hiện vật 3'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  await expect(page.getByRole('region', { name: 'Khám phá chi tiết hiện vật', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[2].id}`));
});

test('typing a new query does not resurrect an old story camera after search arrival', async ({ page }) => {
  await installMuseumApi(page); await open(page);
  await input(page).fill('Hiện vật 2'); await go(page).click();
  await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  await waitForRendererIdle(page); const arrived = await position(page);
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  await input(page).fill('Hiện vật 3'); await waitForRendererIdle(page);
  expect(await position(page)).toEqual(arrived);
  await expect(page).toHaveURL(new RegExp(`exhibit=${roomA.exhibits[1].id}`));
});

test('manual wheel takeover stops the route; room refresh removes stale search results', async ({ page }) => {
  await installMuseumApi(page); await open(page, false); await input(page).fill('Hiện vật 2'); await go(page).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await canvas.dispatchEvent('wheel', { deltaY: 50 });
  await expect(status(page)).toHaveAttribute('data-search-phase', 'cancelled');
  await waitForRendererIdle(page);
  const stopped = await position(page);
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: roomA.exhibits.slice(2) })));
  await page.locator('details[data-catalogue] summary').click();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).last().click();
  await expect(panel(page)).toContainText('Không tìm thấy hiện vật');
  expect(await position(page)).toEqual(stopped);
});

test('E13 context loss cancels route and recovery never replays; room switch and exit discard search', async ({ page }) => {
  await installMuseumApi(page); await open(page, false); await input(page).fill('Hiện vật 2'); await go(page).click();
  await page.getByLabel('Phòng trưng bày 3D', { exact: true }).evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    Reflect.set(window, 'searchRestore', () => extension.restoreContext()); extension.loseContext();
  });
  await expect(page.locator('[data-webgl-status="recovering"]')).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, 'searchRestore')());
  await expect(page.locator('[data-webgl-status="ready"]')).toBeVisible();
  await waitForRendererIdle(page); await expect(status(page)).toHaveAttribute('data-search-phase', 'cancelled');
  await page.getByLabel('Chọn phòng trưng bày', { exact: true }).selectOption('ceramics');
  await page.getByRole('button', { name: 'Tìm trong phòng', exact: true }).click();
  await expect(input(page)).toHaveValue(''); await expect(results(page)).toContainText('Bình gốm');
  await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('E13/E14 XR hides DOM search, cancels route and preserves headset origin', async ({ page }) => {
  await installMuseumApi(page); await installXrSimulation(page); await open(page, false);
  await input(page).fill('Hiện vật 2'); await go(page).click();
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm trong phòng', exact: true })).toHaveCount(0);
  const origin = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.position.toArray());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.position.toArray())).toEqual(origin);
  await page.evaluate(() => window.museumXrFixture.session!.end());
  await expect(status(page)).toHaveAttribute('data-search-phase', 'cancelled');
});

test('E13 model failures keep safe plinth navigation; queries never reload healthy GLBs', async ({ page }) => {
  const { requests } = await installFiveModels(page, { failIndex: 1, failure: 'corrupt' });
  await open(page); await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  const before = [...requests];
  for (const q of ['Hiện vật 1', 'khong co', 'Hiện vật 2']) await input(page).fill(q);
  await go(page).click(); await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
  expect(requests).toEqual(before);
});

test.describe('E11 mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('search stays above joystick and outside guided controls; arrival reveals details', async ({ page }, info) => {
    await installMuseumApi(page); await open(page);
    const box = (await panel(page).boundingBox())!, joystick = (await page.getByRole('button', { name: 'Di chuyển bằng joystick' }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(joystick.y);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await input(page).fill('Hiện vật 2');
    await page.screenshot({ path: info.outputPath('search-mobile.png') });
    await go(page).tap(); await expect(status(page)).toHaveAttribute('data-search-phase', 'arrived');
    await expect(input(page)).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
    const searchBox = (await panel(page).boundingBox())!, detailBox = (await page.getByRole('complementary', { name: 'Chi tiết hiện vật' }).boundingBox())!;
    expect(searchBox.y + searchBox.height).toBeLessThanOrEqual(detailBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
