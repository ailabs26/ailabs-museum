import { expect, test } from '@playwright/test';
import { installFiveModels } from './fixtures/museumGlb';
import { installRendererProbe } from './fixtures/museumProbe';
import type { Object3D } from 'three';

test('five parsed models expose identity-bound 3D and keyboard hotspots with one selection state', async ({ page }) => {
  const { exhibits, requests } = await installFiveModels(page); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible();
  await expect(page.getByText('Lỗi hiển thị mô hình.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Điểm tương tác Hiện vật 2', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Mô tả hiện vật 2');
  await page.evaluate(() => Reflect.set(window, 'allowModelClone', true));
  await page.getByRole('button', { name: 'Thử lại Hiện vật 2', exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible();
  expect(requests).toEqual([1, 1, 1, 1, 1]);
});

for (const failure of [403, 404, 502, 'network', 'corrupt'] as const) test(`one ${failure} GLB preserves four healthy models, interactive placeholder and isolated retry`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { exhibits, requests } = await installFiveModels(page, { failIndex: 1, failure }); await installRendererProbe(page);
  await page.goto('/tour.html'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: `Thử lại ${exhibits[1].name}`, exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible();
  const after = await snapshot(); expect(after.fallbacks).toEqual([]);
  for (const [id, uuid] of Object.entries(before.models)) expect(after.models[id]).toBe(uuid);
  expect(requests).toEqual([1, 2, 1, 1, 1]); expect(errors).toEqual([]);
});
