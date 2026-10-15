import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';

const checksum = 'a'.repeat(64);
const model = (id: string) => ({ id, checksumSha256: checksum, storageKey: 'models/test.glb', sizeBytes: 100,
  url: `/rooms/sculpture/exhibits/${id}/model?version=${checksum}` });

test('permission failures and corrupt GLBs stay isolated and can be retried without crashing the room', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await installMuseumApi(page);
  const exhibit = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA,
    exhibits: [{ ...exhibit, model: model(exhibit.id) }, ...roomA.exhibits.slice(1)] })));
  let requests = 0;
  await page.route('**/api/rooms/sculpture/exhibits/*/model?*', async route => {
    requests++;
    if (requests === 1) await fulfillMuseum(route, { success: false, data: null, message: 'Storage unavailable' }, 502);
    else await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.alloc(100),
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true' } });
  });
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByRole('button', { name: 'Thử lại Hiện vật 1', exact: true })).toBeVisible();
  await expect(page.getByText('Đã tải 0/1 mô hình 3D', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại Hiện vật 1', exact: true }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByRole('button', { name: 'Thử lại Hiện vật 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Hiện vật 2');
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('switching rooms while two GLBs are loading cancels the queue and keeps the next room usable', async ({ page }) => {
  await installMuseumApi(page);
  const models = roomA.exhibits.map((exhibit, index) => {
    const hash = String(index + 1).repeat(64);
    return { ...exhibit, model: { ...model(exhibit.id), checksumSha256: hash,
      url: `/rooms/sculpture/exhibits/${exhibit.id}/model?version=${hash}` } };
  });
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: models })));
  let requests = 0; const aborted: string[] = [];
  page.on('requestfailed', request => { if (request.url().includes('/model?')) aborted.push(request.url()); });
  await page.route('**/api/rooms/sculpture/exhibits/*/model?*', () => { requests++; });
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => requests).toBe(2);
  await page.getByLabel('Chọn phòng trưng bày').selectOption('empty');
  await expect(page.getByText('Phòng này chưa có hiện vật được xuất bản.')).toBeVisible();
  await expect.poll(() => aborted.length).toBe(2);
  expect(requests).toBe(2);
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true })).toBeVisible();
});

test('background clicks clear selection but dragging the background does not', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 20, { steps: 8 }); await page.mouse.up();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  await page.mouse.click(box.x + 20, box.y + 20);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

for (const action of ['reset', 'drag']) test(`finishing a real GLB download respects an earlier camera ${action}`, async ({ page }) => {
  const assetPath = resolve('../back-end/tmp/glb-assets/coc_go_bach_dang.glb');
  test.skip(!existsSync(assetPath), 'Download the verified Storage GLBs before this asset integration check.');
  test.setTimeout(60_000);
  await installMuseumApi(page); await installRendererProbe(page);
  const item = roomA.exhibits[0];
  const hash = '1677adf9ec5e6e6aed8226f8488788ce9a7f283afb1773e40a997c1ab897e182';
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{ ...item,
    model: { ...model(item.id), storageKey: 'models/coc_go_bach_dang.glb', sizeBytes: 3562172, checksumSha256: hash,
      url: `/rooms/sculpture/exhibits/${item.id}/model?version=${hash}` } }] })));
  let finish!: () => void;
  const gate = new Promise<void>(done => { finish = done; });
  await page.route('**/api/rooms/sculpture/exhibits/*/model?*', async route => {
    await gate;
    await route.fulfill({ body: readFileSync(assetPath), contentType: 'model/gltf-binary',
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true' } });
  });
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
  if (action === 'reset') await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  else {
    await canvas.scrollIntoViewIfNeeded(); const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 25); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + 25, { steps: 10 }); await page.mouse.up();
  }
  await page.waitForTimeout(1000);
  let lastFrames = -1; let idleChecks = 0;
  await expect.poll(async () => {
    const frames = (await readRendererProbe(page)).at(-1)!.frames;
    idleChecks = frames === lastFrames ? idleChecks + 1 : 0; lastFrames = frames;
    return idleChecks;
  }, { timeout: 15_000, intervals: [300, 500] }).toBeGreaterThanOrEqual(2);
  const before = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray());
  finish();
  await expect(page.getByText('Đã tải 1/1 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray());
  // A new render can flush sub-EPS OrbitControls inertia; forbid an actual refocus.
  expect(Math.hypot(...after.map((value, index) => value - before[index]))).toBeLessThan(0.01);
  await page.getByRole('button', { name: 'Tập trung hiện vật', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray())).not.toEqual(before);
});
