import { museumExhibitButton, selectMuseumExhibit } from './fixtures/museumUi';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Mesh } from 'three';
import { writeFile } from 'node:fs/promises';
import { roomDetailSchema, roomResponseSchema } from '../src/validations/roomSchema';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';

test.use({ hasTouch: true });

async function readModels(page: Page) {
  return page.evaluate(() => {
    const record = window.museumProbe.at(-1);
    const scene = record?.scene?.deref();
    const camera = record?.camera?.deref();
    const result: { id: string; size: number[]; min: number[]; max: number[]; screen: number[]; screenExtent: number[] }[] = [];
    scene?.updateMatrixWorld(true);
    scene?.traverse(root => {
      if (!root.userData.modelLoaded || !camera) return;
      const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
      const point = root.position.clone();
      root.traverse(object => {
        const mesh = object as Mesh;
        const positions = mesh.geometry?.getAttribute('position');
        if (!positions) return;
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          point.toArray().forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
        }
      });
      const center = root.localToWorld(root.position.clone().fromArray(root.userData.normalization.center));
      const screenExtent = [0, 0];
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
        point.set(x, y, z).project(camera);
        screenExtent[0] = Math.max(screenExtent[0], Math.abs(point.x));
        screenExtent[1] = Math.max(screenExtent[1], Math.abs(point.y));
      }
      result.push({ id: root.userData.artifactId, size: max.map((value, i) => value - min[i]), min, max, screen: center.project(camera).toArray(), screenExtent });
    });
    return result;
  });
}

test('five actual private Storage GLBs render, normalize, pick and focus in one live room', async ({ page }, testInfo) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires configured local backend and verified Storage mapping.');
  test.setTimeout(180_000);
  const errors: string[] = []; const downloads: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (/\/exhibits\/[^/]+\/model\?/.test(response.url()) && response.status() === 200) downloads.push(response.url());
  });
  const response = await page.request.get('http://localhost:3001/api/rooms/bo-suu-tap-glb');
  expect(response.status()).toBe(200);
  const room = roomResponseSchema(roomDetailSchema).parse(await response.json()).data;
  expect(room.exhibits.filter(exhibit => exhibit.model)).toHaveLength(5);
  await installRendererProbe(page);
  await page.goto('/tour.html?room=bo-suu-tap-glb');
  expect(downloads).toHaveLength(0);
  const startedAt = Date.now();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 120_000 });
  const loadMilliseconds = Date.now() - startedAt;
  const models = await readModels(page);
  expect(models).toHaveLength(5);
  for (const exhibit of room.exhibits) {
    const model = models.find(model => model.id === exhibit.id)!;
    expect(model).toBeTruthy();
    expect(model.min[1]).toBeCloseTo(1.14, 3);
    expect((model.min[0] + model.max[0]) / 2).toBeCloseTo(exhibit.positionX!, 3);
    expect((model.min[2] + model.max[2]) / 2).toBeCloseTo(exhibit.positionZ!, 3);
    expect(model.size[0]).toBeLessThanOrEqual(1.8001);
    expect(model.size[1]).toBeLessThanOrEqual(2.2001);
    expect(model.size[2]).toBeLessThanOrEqual(1.8001);
  }
  await canvas.screenshot({ path: testInfo.outputPath('five-live-glbs.png') });
  const selectionEvidence = [];
  for (const exhibit of room.exhibits) {
    await selectMuseumExhibit(page, `Xem chi tiết ${exhibit.name}`);
    await page.waitForTimeout(800);
    const projected = (await readModels(page)).find(model => model.id === exhibit.id)!;
    expect(Math.abs(projected.screen[0])).toBeLessThan(0.08);
    expect(Math.abs(projected.screen[1])).toBeLessThan(0.08);
    expect(Math.max(...projected.screenExtent)).toBeLessThan(0.98);
    const focusedPosition = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray());
    await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
    await page.waitForTimeout(200);
    await canvas.scrollIntoViewIfNeeded();
    const point = (await readModels(page)).find(model => model.id === exhibit.id)!;
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + (point.screen[0] + 1) * box.width / 2, box.y + (1 - point.screen[1]) * box.height / 2);
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibit.name);
    await expect(museumExhibitButton(page, `Xem chi tiết ${exhibit.name}`)).toHaveAttribute('aria-pressed', 'true');
    selectionEvidence.push({ id: exhibit.id, name: exhibit.name, storageKey: exhibit.model!.storageKey, focusPosition: focusedPosition });
    await canvas.screenshot({ path: testInfo.outputPath(`focus-${exhibit.displayOrder}.png`) });
    await page.keyboard.press('Escape');
  }
  expect(new Set(downloads).size).toBe(5);
  expect(downloads).toHaveLength(5);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  await page.waitForTimeout(800);
  const idleBefore = (await readRendererProbe(page)).at(-1)!.frames;
  await page.waitForTimeout(400);
  expect((await readRendererProbe(page)).at(-1)!.frames).toBe(idleBefore);
  const profile = (await readRendererProbe(page)).at(-1)!;
  const interactionStart = await page.evaluate(() => performance.now());
  for (let step = 0; step < 12; step++) { await canvas.press('ArrowRight'); await page.waitForTimeout(20); }
  const interactionEnd = await page.evaluate(() => performance.now());
  const frameTimes = (await readRendererProbe(page)).at(-1)!.times.filter(time => time >= interactionStart && time <= interactionEnd);
  const observedInteractionFps = frameTimes.length > 1 ? (frameTimes.length - 1) * 1000 / (frameTimes.at(-1)! - frameTimes[0]) : null;
  await page.setViewportSize({ width: 390, height: 844 });
  await selectMuseumExhibit(page, `Xem chi tiết ${room.exhibits[3].name}`);
  await page.waitForTimeout(800);
  const portrait = (await readModels(page)).find(model => model.id === room.exhibits[3].id)!;
  expect(Math.abs(portrait.screen[0])).toBeLessThan(0.08);
  expect(Math.abs(portrait.screen[1])).toBeLessThan(0.08);
  expect(Math.max(...portrait.screenExtent)).toBeLessThan(0.98);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-live-glb.png'), fullPage: true });
  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
  await canvas.scrollIntoViewIfNeeded();
  const mobilePoint = (await readModels(page)).find(model => model.id === room.exhibits[3].id)!;
  const mobileBox = (await canvas.boundingBox())!;
  await page.touchscreen.tap(mobileBox.x + (mobilePoint.screen[0] + 1) * mobileBox.width / 2,
    mobileBox.y + (1 - mobilePoint.screen[1]) * mobileBox.height / 2);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(room.exhibits[3].name);
  const evidencePath = testInfo.outputPath('live-glb-evidence.json');
  await writeFile(evidencePath, JSON.stringify({ models, selectionEvidence, profile, loadMilliseconds, observedInteractionFps, downloads: downloads.length }, null, 2));
  await testInfo.attach('live-glb-evidence', { path: evidencePath, contentType: 'application/json' });
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect.poll(async () => (await readRendererProbe(page)).filter(value => value.live).length).toBe(0);
  expect(errors).toEqual([]);
});

test('reopening the actual five-model room releases old contexts and keeps GPU resource counts stable', async ({ page }, testInfo) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires configured backend and Storage content.');
  test.setTimeout(240_000);
  await installRendererProbe(page);
  await page.goto('/tour.html?room=bo-suu-tap-glb');
  const profiles = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 120_000 });
    await page.waitForTimeout(800);
    const current = (await readRendererProbe(page)).at(-1)!;
    profiles.push({ geometries: current.geometries, textures: current.textures, calls: current.calls, triangles: current.triangles });
    expect((await readRendererProbe(page)).filter(value => value.live)).toHaveLength(1);
    await page.getByRole('button', { name: 'Thoát tham quan' }).click();
    await expect.poll(async () => (await readRendererProbe(page)).filter(value => value.live).length).toBe(0);
  }
  expect(profiles[1]).toEqual(profiles[0]);
  const evidencePath = testInfo.outputPath('live-resource-cycles.json');
  await writeFile(evidencePath, JSON.stringify(profiles, null, 2));
  await testInfo.attach('live-resource-cycles', { path: evidencePath, contentType: 'application/json' });
});
