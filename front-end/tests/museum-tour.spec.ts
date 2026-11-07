import { exitMuseumIfOpen, openMuseumTools } from './fixtures/museumUi';
import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';
import { installRendererProbe } from './fixtures/museumProbe';

const EN_TOUR_STRINGS = {
  'ui.tour.eyebrow': 'AURA / MUSEUM TOUR',
  'ui.tour.title': 'Museum tour',
  'ui.tour.lead': 'Published museum content',
  'ui.tour.room.select': 'Select gallery',
  'ui.tour.room.page': 'Gallery page',
  'ui.tour.refresh': 'Refresh',
  'ui.tour.loading.rooms': 'Loading galleries…',
  'ui.tour.error.rooms.title': 'Could not load galleries',
  'ui.tour.retry': 'Try again',
  'ui.tour.empty': 'No public galleries yet.',
  'ui.tour.room.missing': 'The selected gallery is not public. Choose another gallery.',
  'ui.tour.loading.room': 'Loading gallery…',
  'ui.tour.error.room.title': 'Could not load gallery',
  'ui.tour.summary.exhibits': '{count} exhibits',
  'ui.tour.summary.models': 'Open 3D to explore exhibit models',
  'ui.tour.summary.placeholders': 'Placeholder shapes stand in for unavailable images or models',
  'ui.tour.exhibit.missing': 'Exhibit not found in this gallery.',
  'ui.tour.exhibit.invalid': 'The exhibit ID in the URL is invalid.',
  'ui.tour.room.updating': 'Updating gallery…',
  'ui.tour.intro.eyebrow': 'DISCOVER',
  'ui.tour.intro.title': 'Step into the gallery',
  'ui.tour.intro.description': 'Explore {name} in 3D space.',
  'ui.tour.open': 'Open 3D gallery',
  'ui.tour.readable': 'You can also read everything below.',
  'ui.tour.controls.help': 'Hold and drag or swipe to look · Left joystick to move on touch devices. Select an exhibit to see details. In the 3D view: WASD moves, Shift runs, arrow keys turn, +/− zoom, F focuses the selected exhibit, Home resets. Escape closes details · Tab leaves the view.',
  'ui.tour.dialog.label': 'Museum tour',
  'ui.tour.dialog.brand': 'AURA MUSEUM / HERITAGE SPACE',
  'ui.tour.dialog.exit': 'Exit tour',
  'ui.tour.scene.loading': 'Opening 3D gallery…',
  'ui.tour.room.unavailable.title': 'Gallery unavailable',
  'ui.tour.room.unavailable.message': 'This gallery is no longer public. Choose another gallery or leave the tour.',
  'ui.tour.error.loading.title': 'Could not load gallery',
  'ui.tour.catalogue.summary': 'Exhibit catalogue',
  'ui.tour.controls.help.short': 'WASD moves, drag or swipe to look, F focuses, Home resets. Escape closes details, then leaves the tour.',
  'ui.tour.canvas.aria': '3D gallery view',
  'ui.tour.canvas.fallback': 'Your browser cannot display the canvas. Exhibit information remains available in the catalogue below.',
  'ui.tour.scene.restart': 'Restarting the view after a VR error…',
  'ui.tour.scene.recovering': 'Restoring the 3D gallery. You can keep reading the catalogue.',
  'ui.tour.camera.controls': 'View controls',
  'ui.tour.camera.reset': 'Initial view',
  'ui.tour.camera.reset.title': 'Initial view (Home)',
  'ui.tour.camera.focus': 'Focus exhibit',
  'ui.tour.camera.focus.title': 'Focus exhibit (F)',
  'ui.tour.camera.photo': 'Take a photo',
  'ui.tour.camera.zoom.in': 'Zoom in',
  'ui.tour.camera.zoom.out': 'Zoom out',
  'ui.tour.camera.more': 'More controls',
  'ui.tour.vr.checking': 'Checking VR…',
  'ui.tour.vr.unavailable': 'VR is not available in this browser or device. You can still explore in 3D.',
  'ui.tour.vr.enter': 'Enter VR',
  'ui.tour.vr.entering': 'Starting VR…',
  'ui.tour.vr.exit': 'Exit VR',
  'ui.tour.photo.success': 'Saved a 3D gallery photo',
  'ui.tour.photo.error': 'Could not take a photo. Try again after the 3D view finishes loading.',
  'ui.tour.model.placeholder': 'Placeholder shapes stand in for exhibits without a model',
  'ui.tour.hotspots.summary': 'Interactive points',
  'ui.tour.hotspots.group': 'Exhibit interactive points',
  'ui.tour.minimap.group': 'Gallery floor plan',
  'ui.tour.minimap.title': 'Gallery map',
  'ui.tour.minimap.svg': 'Map of {count} exhibits in the gallery',
  'ui.tour.minimap.go': 'Go to {name}',
  'ui.tour.dock.group': 'Quick exhibit selection',
  'ui.tour.dock.focus': 'Point camera at {name}',
  'ui.tour.navigation.help.hide': 'Hide instructions',
  'ui.tour.navigation.help.show': 'Movement instructions',
  'ui.tour.navigation.touch': 'Use the left joystick to move · Swipe the right view area to turn · Tap an exhibit to see it',
  'ui.tour.navigation.keyboard': 'WASD moves · Hold and drag to look · Shift runs · F focuses · Home resets',
  'ui.tour.navigation.status.focusing': 'Focusing exhibit',
  'ui.tour.navigation.status.inspect': 'Viewing exhibit · Move to keep exploring',
  'ui.tour.navigation.status.ready': 'Ready to explore',
  'ui.tour.navigation.status.touch': 'Touch the joystick or swipe to explore',
  'ui.tour.navigation.status.idle': 'Select the 3D view to start moving',
  'ui.tour.navigation.joystick': 'Move with joystick',
  'ui.tour.model.status': '3D model status',
  'ui.tour.model.loaded': 'Loaded {ready}/{total} 3D models',
  'ui.tour.model.loading': 'Loading 3D model',
  'ui.tour.model.unavailable': '3D model unavailable',
  'ui.tour.model.read': 'Select to read about this exhibit',
  'ui.tour.model.progress': 'Model loading progress',
  'ui.tour.model.error': 'Could not load model: {name}. {error}',
  'ui.tour.model.render-error': 'Model rendering error.',
  'ui.tour.model.retry': 'Retry {name}',
  'ui.tour.model.failure.download': 'The 3D model could not be downloaded. Please try again.',
  'ui.tour.model.failure.format': 'The 3D model file is corrupted or uses an unsupported format.',
  'ui.tour.model.exhausted': 'No retries left. Reopen 3D or contact an administrator.',
  'ui.tour.model.cooldown': 'Wait before trying again.',
  'ui.tour.model.retries': '{count} attempts left.',
  'ui.tour.catalogue.title': 'In the gallery',
  'ui.tour.catalogue.models': 'Exhibit models can be explored in 3D. The catalogue remains readable without 3D.',
  'ui.tour.catalogue.placeholders': 'There are no images or 3D models yet; placeholder shapes are shown.',
  'ui.tour.catalogue.outside': 'Some exhibits are only available in the catalogue below because they are outside the 3D gallery.',
  'ui.tour.catalogue.empty': 'This gallery has no published exhibits.',
  'ui.tour.catalogue.exhibits': 'Exhibits',
  'ui.tour.catalogue.item': 'Exhibit {number}',
  'ui.tour.catalogue.select': 'View details',
  'ui.tour.catalogue.selected': 'Viewing details',
  'ui.tour.catalogue.select.aria': 'View details for {name}',
  'ui.tour.catalogue.outside-room': 'This exhibit is outside the 3D gallery. You can read its information here.',
  'ui.tour.fallback.title': 'Could not open 3D gallery',
  'ui.tour.fallback.description': 'Your device may not support WebGL, or the view may not have loaded.',
  'ui.tour.fallback.read2d': 'Continue reading in the 2D view',
  'ui.tour.fallback.catalogue': 'Read the gallery catalogue',
  'ui.tour.fallback.retry': 'Retry 3D',
  'ui.tour.fallback.retries': '{count} 3D attempts remain in this visit.',
  'ui.tour.fallback.exhausted': 'No 3D attempts remain. You can still read all 2D content.',
  'ui.tour.panel.label': 'Exhibit details',
  'ui.tour.panel.viewing': 'Viewing',
  'ui.tour.panel.close': 'Close exhibit details',
  'ui.tour.panel.close.action': 'Close',
  'ui.tour.panel.read2d': 'Read 2D details',
  'ui.tour.panel.report': 'Report content',
  'ui.tour.panel.model': 'Explore the exhibit model in the 3D gallery.',
  'ui.tour.panel.description': 'Exhibit description',
  'ui.tour.panel.story': 'Exhibit story',
  'ui.tour.panel.empty': 'No description available.',
  'ui.tour.panel.transcript': 'Narration transcript',
  'ui.tour.panel.hotspots': 'Points of interest',
  'ui.tour.panel.credits': 'Sources & copyright',
  'ui.tour.panel.credits.aria': 'Sources and copyright',
  'ui.tour.panel.outside-room': 'This exhibit is outside the 3D gallery. You can still read its information here.',
  'ui.tour.panel.help': 'Press Escape to close · Select another exhibit to keep exploring',
  'ui.tour.hotspot.select': 'Select to explore',
  'ui.tour.hotspot.aria': 'Interactive point {name}',
  'ui.tour.vr.instructions.title': 'VR tour',
  'ui.tour.vr.enter.error': 'Could not start VR. You can still explore in 3D and try again.',
  'ui.tour.vr.instructions': 'Look at an interactive point and press the trigger to select an exhibit. Look at empty floor and press the trigger to teleport (up to 8 m, with no plinth in the way). Use the right controller stick to turn in 30° steps.\n\nWithout controllers: gaze for 1.5 seconds to select, or use your device’s selection action. Gaze does not teleport.',
  'ui.tour.vr.page.previous': 'Previous',
  'ui.tour.vr.page.next': 'Next',
  'ui.tour.vr.page.exit': 'Exit VR',
  'ui.tour.vr.exit-error': 'Use the headset’s exit button or try leaving VR again.',
  'ui.language.label': 'Language',
};

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

test('tour locale updates inside 3D without replacing the scene renderer', async ({ page }) => {
  test.setTimeout(60_000);
  await installRendererProbe(page);
  await page.route('**/api/public/translations**', route => {
    const locale = new URL(route.request().url()).searchParams.get('locale');
    return fulfillMuseum(route, { success: true, data: locale === 'en' ? EN_TOUR_STRINGS : {}, message: null });
  });
  await page.goto('/tour');
  await page.getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Step into the gallery' })).toBeVisible();
  await page.getByRole('button', { name: 'Open 3D gallery' }).click();

  const dialog = page.getByRole('dialog', { name: 'Museum tour' });
  await expect(dialog.getByRole('button', { name: 'Exit tour' })).toBeVisible();
  const canvas = dialog.getByLabel('3D gallery view');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole('button', { name: 'Take a photo' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Movement instructions' }).click();
  await expect(dialog.getByText('WASD moves · Hold and drag to look · Shift runs · F focuses · Home resets')).toBeVisible();
  const originalCanvas = await canvas.elementHandle();
  const originalRenderer = await page.evaluateHandle(() => window.museumProbe.at(-1)!.renderer.deref()!);

  const japaneseTranslations = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/public/translations') && url.searchParams.get('locale') === 'ja';
  });
  await dialog.getByRole('combobox', { name: 'Language' }).selectOption('ja');
  await japaneseTranslations;
  await expect(page.getByRole('dialog', { name: 'Tham quan bảo tàng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thoát tham quan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chụp ảnh' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Step into the gallery' })).toHaveCount(0);
  const localizedCanvas = page.getByRole('dialog', { name: 'Tham quan bảo tàng' }).getByLabel('Phòng trưng bày 3D');
  await expect(localizedCanvas).toHaveAttribute('aria-label', 'Phòng trưng bày 3D');
  expect(await page.evaluate((element) => document.querySelector('canvas') === element, originalCanvas)).toBe(true);
  expect(await page.evaluate((renderer) => window.museumProbe.at(-1)!.renderer.deref() === renderer, originalRenderer)).toBe(true);
  await originalCanvas?.dispose();
  await originalRenderer.dispose();
});

test('English tour localizes model download and format failures', async ({ page }) => {
  test.setTimeout(60_000);
  const models = roomA.exhibits.slice(0, 2).map((exhibit, index) => {
    const checksum = String(index + 1).padStart(64, '0');
    return {
      ...exhibit,
      model: {
        id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        storageKey: `fixture/model-${index}.glb`, sizeBytes: 3, checksumSha256: checksum,
        url: `/rooms/sculpture/exhibits/${exhibit.id}/model?version=${checksum}`,
      },
    };
  });
  const roomWithModels = { ...roomA, exhibits: [...models, ...roomA.exhibits.slice(2)] };
  await page.route('**/api/public/translations**', route => {
    const locale = new URL(route.request().url()).searchParams.get('locale');
    return fulfillMuseum(route, { success: true, data: locale === 'en' ? EN_TOUR_STRINGS : {}, message: null });
  });
  await page.route(url => new URL(url).pathname === '/api/rooms/sculpture', route =>
    fulfillMuseum(route, { success: true, data: roomWithModels, message: null }));
  await page.route(url => new URL(url).pathname.endsWith('/model'), route => {
    const pathname = new URL(route.request().url()).pathname;
    return pathname.includes(roomA.exhibits[0].id)
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.from('bad') });
  });

  await page.goto('/tour');
  await page.getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Step into the gallery' })).toBeVisible();
  await page.getByRole('button', { name: 'Open 3D gallery' }).click();

  const dialog = page.getByRole('dialog', { name: 'Museum tour' });
  await expect(dialog.getByText('The 3D model could not be downloaded. Please try again.')).toBeVisible();
  await expect(dialog.getByText('The 3D model file is corrupted or uses an unsupported format.')).toBeVisible();
  await expect(dialog.getByText('Không tải được mô hình. Vui lòng thử lại.')).toHaveCount(0);
  await expect(dialog.getByText('Tệp mô hình bị hỏng hoặc có định dạng chưa hỗ trợ.')).toHaveCount(0);
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
