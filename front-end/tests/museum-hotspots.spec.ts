import { expect, test } from '@playwright/test';
import { installFiveModels } from './fixtures/museumGlb';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';
import type { Object3D } from 'three';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

async function projectedPoint(page: import('@playwright/test').Page, artifactId: string, kind: 'hotspot' | 'fallback') {
  // Closing the details panel resizes Canvas before R3F updates camera aspect.
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await page.getByLabel('Phòng trưng bày 3D', { exact: true }).scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => {
    const record = window.museumProbe.at(-1); const camera = record?.camera?.deref();
    const canvas = document.querySelector('canvas');
    return !!camera && !!canvas && 'aspect' in camera && Math.abs(Number(camera.aspect) - canvas.clientWidth / canvas.clientHeight) < 0.01;
  })).toBe(true);
  return page.evaluate(({ artifactId, kind }) => {
    const record = window.museumProbe.at(-1)!; const scene = record.scene!.deref()!; const camera = record.camera!.deref()!;
    let result: number[] | undefined; scene.updateMatrixWorld(true);
    scene.traverse(object => {
      if (object.userData.artifactId !== artifactId || !(kind === 'hotspot' ? object.userData.hotspotId : object.userData.artifactFallback)) return;
      const point = object.position.clone().set(0, kind === 'fallback' ? 0.5 : 0, 0); result = object.localToWorld(point).project(camera).toArray();
    }); return result!;
  }, { artifactId, kind });
}

test('3D hotspot mouse picking shares selection, hover tooltip and drag rejection', async ({ page }, testInfo) => {
  const { exhibits } = await installFiveModels(page); await installRendererProbe(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  for (const item of exhibits) {
    await page.getByRole('button', { name: `Điểm tương tác ${item.name}`, exact: true }).click();
    await page.keyboard.press('Escape'); await canvas.scrollIntoViewIfNeeded();
    const point = await projectedPoint(page, item.id, 'hotspot'); const box = (await canvas.boundingBox())!;
    expect(Math.abs(point[0])).toBeLessThan(1); expect(Math.abs(point[1])).toBeLessThan(1);
    const x = box.x + (point[0] + 1) * box.width / 2, y = box.y + (1 - point[1]) * box.height / 2;
    await page.mouse.move(x, y); await expect(canvas).toHaveCSS('cursor', 'pointer');
    await page.mouse.click(x, y);
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(item.name);
  }
  await canvas.screenshot({ path: testInfo.outputPath('hotspots-desktop.png') });
  await page.keyboard.press('Escape'); await canvas.scrollIntoViewIfNeeded();
  const point = await projectedPoint(page, exhibits[4].id, 'hotspot'); const box = (await canvas.boundingBox())!;
  const x = box.x + (point[0] + 1) * box.width / 2, y = box.y + (1 - point[1]) * box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 35, y, { steps: 8 }); await page.mouse.up();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('a camera drag away from a hotspot and back to its starting point never selects it', async ({ page }) => {
  const { exhibits } = await installFiveModels(page); await installRendererProbe(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 2', exact: true }).click(); await page.keyboard.press('Escape');
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await canvas.scrollIntoViewIfNeeded();
  const point = await projectedPoint(page, exhibits[1].id, 'hotspot'); const box = (await canvas.boundingBox())!;
  const x = box.x + (point[0] + 1) * box.width / 2, y = box.y + (1 - point[1]) * box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 35, y, { steps: 8 }); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test.describe('touch hotspot controls', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch selects a failed artifact marker and keyboard Space selects another artifact', async ({ page }, testInfo) => {
    const { exhibits } = await installFiveModels(page, { failIndex: 1, failure: 404 }); await installRendererProbe(page);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 2', exact: true }).click(); await page.keyboard.press('Escape');
    const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await canvas.scrollIntoViewIfNeeded();
    const point = await projectedPoint(page, exhibits[1].id, 'hotspot'); const box = (await canvas.boundingBox())!;
    await page.touchscreen.tap(box.x + (point[0] + 1) * box.width / 2, box.y + (1 - point[1]) * box.height / 2);
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibits[1].name);
    const button = page.getByRole('button', { name: 'Điểm tương tác Hiện vật 3', exact: true }); await button.focus(); await page.keyboard.press('Space');
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibits[2].description);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('hotspots-mobile.png'), fullPage: true });
  });
});

test('metadata refresh updates annotations without downloading healthy GLBs again', async ({ page }) => {
  const { exhibits, requests } = await installFiveModels(page); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: exhibits.map((item, index) => index === 1 ? { ...item, name: 'Tên đã cập nhật', description: 'Nội dung đã cập nhật' } : item) })));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.getByRole('button', { name: 'Điểm tương tác Tên đã cập nhật', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Nội dung đã cập nhật');
  expect(requests).toEqual([1, 1, 1, 1, 1]);
});

test('multiple published annotations preserve coordinates and bind their labels to one artifact', async ({ page }) => {
  const { exhibits } = await installFiveModels(page); await installRendererProbe(page);
  const annotations = [{ id: '20000000-0000-4000-8000-000000000001', label: 'Hoa văn', body: 'Nội dung hoa văn', positionX: 0, positionY: 0.6, positionZ: 0.4, displayOrder: 0 },
    { id: '20000000-0000-4000-8000-000000000002', label: 'Chất liệu', body: 'Nội dung chất liệu', positionX: 0.3, positionY: 0.8, positionZ: 0, displayOrder: 1 }];
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: exhibits.map((item, index) => index === 1 ? { ...item, hotspots: annotations } : item) })));
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.scene?.deref())).toBe(true);
  const points = await page.evaluate(() => {
    const points: Record<string, number[]> = {};
    window.museumProbe.at(-1)!.scene!.deref()!.traverse(object => { if (object.userData.artifactId?.endsWith('000002') && object.userData.hotspotId) points[object.userData.hotspotId] = object.position.toArray(); });
    return points;
  });
  expect(points[annotations[0].id][1]).toBeCloseTo(1.14 + 0.6 * 1.8);
  expect(points[annotations[0].id][2]).toBeCloseTo(0.4 * 1.8);
  for (const annotation of annotations) {
    await page.getByRole('button', { name: `Điểm tương tác Hiện vật 2: ${annotation.label}`, exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(annotation.body);
  }
});

test('a genuine GLTFLoader parser rejection falls back per artifact after header and checksum validation', async ({ page }) => {
  await installFiveModels(page, { brokenAccessor: true }); await installRendererProbe(page);
  const diagnostics: string[] = []; page.on('console', message => { if (message.text().includes('[museum:model]')) diagnostics.push(message.text()); });
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  expect(diagnostics.some(message => message.includes('stage: parse'))).toBe(true);
  await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 2', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Mô tả hiện vật 2');
});

test('per-artifact retry cooldown unlocks the button and stops after three retries', async ({ page }) => {
  const { exhibits } = await installFiveModels(page); let attempts = 0;
  await page.route(`**/api/rooms/sculpture/exhibits/${exhibits[1].id}/model?*`, route => {
    attempts++; return fulfillMuseum(route, { success: false, data: null, message: 'Controlled failure' }, 503);
  });
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const retry = page.getByRole('button', { name: 'Thử lại Hiện vật 2', exact: true });
  await expect(retry).toBeEnabled({ timeout: 15_000 }); await retry.click();
  await expect(retry).toBeDisabled(); await expect(retry).toBeEnabled({ timeout: 5000 }); await retry.click();
  await expect(retry).toBeDisabled(); await expect(retry).toBeEnabled({ timeout: 6000 }); await retry.click();
  await expect(page.getByText('Đã hết lượt thử. Vui lòng mở lại 3D hoặc liên hệ quản trị.', { exact: true })).toBeVisible();
  await expect(retry).toBeDisabled(); expect(attempts).toBe(4);
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
});

test('hover tooltips release their textures and mounted hotspots preserve demand rendering', async ({ page }) => {
  const { exhibits } = await installFiveModels(page); await installRendererProbe(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 2', exact: true }).click(); await page.keyboard.press('Escape');
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await canvas.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0); await page.waitForTimeout(200);
  const before = (await readRendererProbe(page)).at(-1)!;
  for (let index = 0; index < 4; index++) {
    const point = await projectedPoint(page, exhibits[1].id, 'hotspot'); const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + (point[0] + 1) * box.width / 2, box.y + (1 - point[1]) * box.height / 2);
    await expect(canvas).toHaveCSS('cursor', 'pointer');
    await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.textures).toBe(before.textures + 1);
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.textures).toBe(before.textures);
  }
  await page.waitForTimeout(200); const idle = (await readRendererProbe(page)).at(-1)!.frames;
  await page.waitForTimeout(250); expect((await readRendererProbe(page)).at(-1)!.frames).toBe(idle);
});

test('five parsed models expose identity-bound 3D and keyboard hotspots with one selection state', async ({ page }) => {
  const { exhibits, requests } = await installFiveModels(page); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.scene?.deref())).toBe(true);
  const markers = await page.evaluate(() => {
    const ids: string[] = []; window.museumProbe.at(-1)!.scene!.deref()!.traverse(object => { if (object.userData.hotspotId) ids.push(object.userData.artifactId); }); return ids;
  });
  expect(markers.sort()).toEqual(exhibits.map(item => item.id).sort());
  for (const item of exhibits) {
    const hotspot = page.getByRole('button', { name: `Điểm tương tác ${item.name}`, exact: true });
    await hotspot.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(item.description);
    await expect(hotspot).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: `Xem chi tiết ${item.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  expect(requests).toEqual([1, 1, 1, 1, 1]);
});

test('invalid optional mesh keeps its valid sibling and all five artifacts render', async ({ page }) => {
  await installFiveModels(page, { invalidMesh: true }); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.scene?.deref())).toBe(true);
  const meshCounts = await page.evaluate(() => {
    const counts: number[] = [];
    window.museumProbe.at(-1)!.scene!.deref()!.traverse(root => {
      if (!root.userData.modelLoaded) return;
      let count = 0; root.traverse(child => { if ('isMesh' in child && child.isMesh) count++; }); counts.push(count);
    }); return counts;
  });
  expect(meshCounts).toEqual([1, 1, 1, 1, 1]);
});

test('a model clone/render exception is contained per artifact and retries without refetching healthy assets', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const { requests } = await installFiveModels(page, { gate }); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.scene?.deref())).toBe(true);
  await page.evaluate(() => {
    const scene = window.museumProbe.at(-1)!.scene!.deref()!;
    const prototype = Object.getPrototypeOf(Object.getPrototypeOf(scene)) as Object3D;
    const original = prototype.clone;
    prototype.clone = function (...args) {
      if (this.name === 'source-1' && !Reflect.get(window, 'allowModelClone')) throw new Error('Controlled model render failure');
      return original.apply(this, args);
    };
  });
  release();
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Lỗi hiển thị mô hình.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 2', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Mô tả hiện vật 2');
  await page.evaluate(() => Reflect.set(window, 'allowModelClone', true));
  await page.getByRole('button', { name: 'Thử lại Hiện vật 2', exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  expect(requests).toEqual([1, 1, 1, 1, 1]);
});

for (const failure of [403, 404, 502, 'network', 'corrupt'] as const) test(`one ${failure} GLB preserves four healthy models, interactive placeholder and isolated retry`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { exhibits, requests } = await installFiveModels(page, { failIndex: 1, failure }); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  const snapshot = () => page.evaluate(() => {
    const models: Record<string, string> = {}; const fallbacks: string[] = [];
    window.museumProbe.at(-1)!.scene!.deref()!.traverse(object => {
      if (object.userData.modelLoaded) models[object.userData.artifactId] = object.uuid;
      if (object.userData.artifactFallback) fallbacks.push(object.userData.artifactId);
    }); return { models, fallbacks };
  });
  const before = await snapshot(); expect(Object.keys(before.models)).toHaveLength(4); expect(before.fallbacks).toEqual([exhibits[1].id]);
  await page.getByRole('button', { name: `Điểm tương tác ${exhibits[1].name}`, exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibits[1].description);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Tập trung hiện vật', exact: true }).click();
  await page.waitForTimeout(650); await page.keyboard.press('Escape');
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true }); await canvas.scrollIntoViewIfNeeded();
  const point = await projectedPoint(page, exhibits[1].id, 'fallback'); const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + (point[0] + 1) * box.width / 2, box.y + (1 - point[1]) * box.height / 2);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibits[1].description);
  await page.getByRole('button', { name: `Thử lại ${exhibits[1].name}`, exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  const after = await snapshot(); expect(after.fallbacks).toEqual([]);
  for (const [id, uuid] of Object.entries(before.models)) expect(after.models[id]).toBe(uuid);
  expect(requests).toEqual([1, 2, 1, 1, 1]); expect(errors).toEqual([]);
});
