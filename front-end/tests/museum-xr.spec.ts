import { museumExhibitButton, openMuseumCatalogue, openMuseumTools, selectMuseumExhibit } from './fixtures/museumUi';
import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';
import { aimXr, installXrSimulation } from './fixtures/museumXr';
import { installRendererProbe, readRendererProbe, waitForRendererIdle } from './fixtures/museumProbe';
import { installFiveModels } from './fixtures/museumGlb';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });
test.setTimeout(60_000);
// Match the existing navigation suite's cold production chunk readiness gate.
const sceneReady = { timeout: 30_000 };

test('decorative floor joints do not block teleport along the central aisle', async ({ page }) => {
  await installRendererProbe(page); await installXrSimulation(page); await installFiveModels(page);
  await page.goto('/tour'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible(sceneReady);
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  await aimXr(page, [0, 0, 4]);
  await page.evaluate(() => window.museumXrFixture.select());
  await expect.poll(() => page.evaluate(() => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    return camera.parent!.position.z;
  })).toBeCloseTo(4, 1);
});
test('2D catalogue renders published images and permits deliberate 3D retry without refetch or selection loss', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/rooms/sculpture', async route => {
    requests++;
    await route.fulfill({ json: envelope({ ...roomA, exhibits: [{ ...roomA.exhibits[0], image: {
      id: roomA.exhibits[0].id, url: 'https://museum.test/image.png', mimeType: 'image/png', sizeBytes: 20,
      rights: { source: null, author: null, license: null }, altText: { vi: 'Ảnh hiện vật xuất bản', en: null },
    } }, ...roomA.exhibits.slice(1)] }) });
  });
  await page.route('https://museum.test/image.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCRkAAAAASUVORK5CYII=', 'base64') }));
  await page.addInitScript(() => {
    Reflect.set(window, 'block3d', true);
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') && Reflect.get(window, 'block3d')) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/tour.html?room=sculpture');
  await expect(page.getByRole('img', { name: 'Ảnh hiện vật xuất bản' })).toBeVisible();
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 1');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await page.evaluate(() => Reflect.set(window, 'block3d', false));
  await page.getByRole('button', { name: 'Thử lại 3D', exact: true }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible(sceneReady);
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 1')).toHaveAttribute('aria-pressed', 'true');
  expect(requests).toBe(1);
});
test('unsupported XR keeps the existing 3D scene and web navigation', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined }));
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible(sceneReady);
  await openMuseumTools(page);
  await expect(page.getByText('VR không khả dụng trong trình duyệt hoặc thiết bị này. Bạn vẫn có thể tham quan 3D.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter VR', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true })).toBeEnabled();
});
test('a supported but refused VR request preserves canvas, selection and permits retry', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'xr', { configurable: true, value: Object.assign(new EventTarget(), {
    isSessionSupported: async () => true,
    requestSession: () => { (window as unknown as { requests: number }).requests = ((window as unknown as { requests: number }).requests || 0) + 1; return Promise.reject(new DOMException('denied', 'NotAllowedError')); },
  }) }));
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await expect(canvas).toBeVisible(sceneReady);
  await canvas.evaluate(node => { node.dataset.identity = 'original'; });
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.getByText('Không thể vào VR. Bạn vẫn có thể tham quan 3D và thử lại.')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-identity', 'original');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Hiện vật 2');
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { requests: number }).requests)).toBe(2);
});
test('actual context restores the same canvas and keeps logical selection', async ({ page }) => {
  await installRendererProbe(page);
  const { requests } = await installFiveModels(page);
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await expect(canvas).toBeVisible(sceneReady);
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible();
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  await canvas.evaluate((node: HTMLCanvasElement) => {
    node.dataset.identity = 'original';
    const extension = node.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    (window as unknown as { restoreContext: () => void }).restoreContext = () => extension.restoreContext(); extension.loseContext();
  });
  await expect(page.getByText('Đang khôi phục không gian 3D. Bạn có thể tiếp tục đọc danh mục.')).toBeVisible();
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 2')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => (window as unknown as { restoreContext: () => void }).restoreContext());
  await expect(page.locator('[data-webgl-status="ready"]')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-identity', 'original');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Hiện vật 2');
  await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true })).toBeEnabled();
  await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.triangles).toBeGreaterThan(0);
  expect(requests).toEqual([1, 1, 1, 1, 1]);
  await page.screenshot({ path: 'tmp/xr-restored.png', fullPage: true });
});

test('simulated native XR renders stereo, selects once, teleports, snap-turns and restores web camera without reloading GLBs', async ({ page }) => {
  await installRendererProbe(page); await installXrSimulation(page);
  const { requests } = await installFiveModels(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.camera?.deref())).toBe(true);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
  await waitForRendererIdle(page);
  const saved = await page.evaluate(() => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), aspect: (camera as import('three').PerspectiveCamera).aspect };
  });
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await canvas.evaluate(node => { node.dataset.identity = 'original'; });
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.museumProbe.at(-1)!.renderer.deref()!.xr.getCamera().cameras.length)).toBe(2);
  // The in-world panel has native ray targets and real texture data.
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)!.scene!.deref()!.getObjectByName('xr-details'))).toBe(true);
  await aimXr(page, [1.8, 3.16, 2]);
  await page.evaluate(() => window.museumXrFixture.select());
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 5')).toHaveAttribute('aria-pressed', 'true');
  // Move the target clear of the detail panel and away from exhibit proxies.
  await aimXr(page, [4, 0, 3.7]);
  await page.evaluate(() => window.museumXrFixture.select());
  await expect.poll(() => page.evaluate(() => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    return camera.parent!.position.x;
  })).toBeCloseTo(4, 1);
  const before = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.rotation.y);
  await page.evaluate(() => { window.museumXrFixture.axes[2] = 0.9; });
  await expect.poll(() => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.rotation.y)).toBeCloseTo(before - Math.PI / 6, 3);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.rotation.y)).toBeCloseTo(before - Math.PI / 6, 3);
  const exitPoint = await page.evaluate(() => {
    const record = window.museumProbe.at(-1)!;
    const button = record.scene!.deref()!.getObjectByName('xr-details')!.children.find(child => child.userData.xrAction === 'exit')!;
    return button.getWorldPosition(record.camera!.deref()!.position.clone()).toArray();
  });
  await aimXr(page, exitPoint); await page.evaluate(() => window.museumXrFixture.select());
  await expect(page.locator('[data-xr-phase="idle"]')).toBeVisible();
  const restored = await page.evaluate(() => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), aspect: (camera as import('three').PerspectiveCamera).aspect };
  });
  expect(restored.position).toEqual(saved.position); expect(restored.quaternion).toEqual(saved.quaternion);
  // Restore the entry lens with the responsive viewport's current aspect.
  restored.projection.forEach((value, index) => { if (index !== 0) expect(value).toBeCloseTo(saved.projection[index], 5); });
  expect(restored.projection[0]).toBeCloseTo(restored.projection[5] / restored.aspect, 5);
  await expect(canvas).toHaveAttribute('data-identity', 'original');
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 5')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  await page.evaluate(() => window.museumXrFixture.disconnect());
  await page.evaluate(() => window.museumXrFixture.session!.end());
  await expect(page.locator('[data-xr-phase="idle"]')).toBeVisible();
  expect(requests).toEqual([1, 1, 1, 1, 1]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.museumXrFixture.requests)).toBe(2);
});

test('repeated actual context losses exhaust recovery into stable readable 2D', async ({ page }) => {
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await expect(canvas).toBeVisible(sceneReady);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  for (let loss = 0; loss < 2; loss++) {
    await canvas.evaluate((node: HTMLCanvasElement) => {
      const extension = node.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
      Reflect.set(window, 'restoreMuseumContext', () => extension.restoreContext()); extension.loseContext();
    });
    await expect(page.locator('[data-webgl-status="recovering"]')).toBeVisible();
    await page.evaluate(() => Reflect.get(window, 'restoreMuseumContext')());
    await expect(page.locator('[data-webgl-status="ready"]')).toBeVisible();
  }
  await canvas.evaluate((node: HTMLCanvasElement) => node.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 2')).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await openMuseumCatalogue(page);
  await expect(museumExhibitButton(page, 'Xem chi tiết Bình gốm')).toBeVisible();
});

test('native session end during initialization never resurrects XR or throws a renderer event error', async ({ page }) => {
  await installXrSimulation(page, { holdBinding: true }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!window.museumXrFixture.finishBinding)).toBe(true);
  await page.evaluate(async () => { await window.museumXrFixture.session!.end(); window.museumXrFixture.finishBinding!(); });
  await expect(page.locator('[data-xr-phase="idle"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});
test('native renderer binding failure recreates only Canvas and retains cached GLBs and selection', async ({ page }) => {
  await installXrSimulation(page, { failBinding: true }); await installRendererProbe(page);
  const { requests } = await installFiveModels(page); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.museumXrFixture.requests)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.museumProbe.length), { timeout: 15_000 }).toBe(2);
  await expect(page.locator('[data-webgl-status="ready"][data-xr-phase="idle"]')).toBeVisible();
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 2')).toHaveAttribute('aria-pressed', 'true');
  expect(requests).toEqual([1, 1, 1, 1, 1]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.museumXrFixture.requests)).toBe(1);
});

test('actual context loss during XR ends the session and restores normal 3D without automatic re-entry', async ({ page }) => {
  await installXrSimulation(page); await installRendererProbe(page);
  const { requests } = await installFiveModels(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await canvas.evaluate((node: HTMLCanvasElement) => {
    node.dataset.identity = 'xr-original';
    const extension = node.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    Reflect.set(window, 'restoreXrContext', () => extension.restoreContext()); extension.loseContext();
  });
  await expect(page.locator('[data-webgl-status="recovering"][data-xr-phase="idle"]')).toBeVisible();
  await page.evaluate(() => Reflect.get(window, 'restoreXrContext')());
  await expect(page.locator('[data-webgl-status="ready"][data-xr-phase="idle"]')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-identity', 'xr-original');
  await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true })).toBeEnabled();
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 2')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.museumXrFixture.requests)).toBe(1);
  expect(requests).toEqual([1, 1, 1, 1, 1]); expect(errors).toEqual([]);
});

test('a controller-free session can gaze at the in-world Exit without moving the origin', async ({ page }) => {
  await installXrSimulation(page); await installRendererProbe(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tour.html?room=sculpture'); await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(page.locator('[data-xr-phase="active"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const panel = window.museumProbe.at(-1)!.scene?.deref()?.getObjectByName('xr-details');
    return !!panel && panel.position.z < -.5;
  })).toBe(true);
  const before = await page.evaluate(() => {
    window.museumXrFixture.disconnect();
    const record = window.museumProbe.at(-1)!, camera = record.camera!.deref()!, origin = camera.parent!;
    const button = record.scene!.deref()!.getObjectByName('xr-details')!.children.find(child => child.userData.xrAction === 'exit')!;
    const point = origin.worldToLocal(button.getWorldPosition(camera.position.clone()));
    const head = camera.position.clone().set(0, 1.7, 0);
    window.museumXrFixture.head = camera.matrix.clone().lookAt(head, point, camera.up).setPosition(head).toArray();
    return origin.position.toArray();
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.position.toArray())).toEqual(before);
  await expect(page.locator('[data-xr-phase="idle"]')).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => window.museumXrFixture.ends)).toBe(1); expect(errors).toEqual([]);
});

test('persistent WebGL failure exhausts only two deliberate retries and leaves readable 2D', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      return type.startsWith('webgl') ? null : Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/tour.html?room=sculpture');
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  for (let retry = 0; retry < 2; retry++) {
    await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible(sceneReady);
    await page.getByRole('button', { name: 'Thử lại 3D', exact: true }).click();
  }
  await expect(page.getByText('Đã hết lượt thử 3D. Bạn vẫn có thể đọc toàn bộ nội dung 2D.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thử lại 3D', exact: true })).toHaveCount(0);
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas')).toHaveCount(0);
});
