import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';

test('production scene resource and lifecycle profile', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const requests = await installMuseumApi(page);
  await installRendererProbe(page);
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize as number;
  };
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/tour.html');
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeVisible();
  expect(await readRendererProbe(page)).toHaveLength(0);
  // Record duplicate requests in the baseline; never fetch unselected rooms.
  expect([...new Set(requests)]).toEqual(['/api/rooms', '/api/rooms/sculpture']);
  const beforeHeap = await heap();
  const started = Date.now();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const initializationMs = Date.now() - started;
  await page.waitForTimeout(800); // Observe settled demand rendering, not a readiness substitute.
  const initial = (await readRendererProbe(page)).at(-1)!;
  expect(initial.calls).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  expect((await readRendererProbe(page)).at(-1)!.frames).toBe(initial.frames);
  const liveHeap = await heap();
  await canvas.screenshot({ path: testInfo.outputPath('day4-scene.png') });
  const box = (await canvas.boundingBox())!;
  const beforeDrag = (await readRendererProbe(page)).at(-1)!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55, { steps: 30 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const afterDrag = (await readRendererProbe(page)).at(-1)!;
  expect(afterDrag.frames).toBeGreaterThan(beforeDrag.frames);
  const dragTimes = afterDrag.times.slice(-(afterDrag.frames - beforeDrag.frames));
  const observedDragFps = dragTimes.length > 1 ? (dragTimes.length - 1) * 1000 / (dragTimes.at(-1)! - dragTimes[0]) : null;
  const mounted = [];
  const released = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    mounted.push((await readRendererProbe(page)).at(-1)!);
    await page.getByRole('button', { name: 'Dừng 3D' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(async () => (await readRendererProbe(page)).filter((renderer) => renderer.live).length).toBe(0);
    released.push(await heap());
    if (cycle < 3) {
      await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
      await expect(canvas).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(300);
      expect((await readRendererProbe(page)).filter((renderer) => renderer.live)).toHaveLength(1);
    }
  }
  expect(pageErrors).toEqual([]);
  const profilePath = testInfo.outputPath('profile.json');
  await writeFile(profilePath, JSON.stringify({
    browser: await page.context().browser()?.version(), viewport: page.viewportSize(),
    renderer: 'Edge/SwiftShader; emulation, not physical GPU', initializationMs, observedDragFps,
    beforeHeap, liveHeap, releasedHeapBytes: released, initial, mounted, requests,
  }, null, 2));
  await testInfo.attach('profile.json', { path: profilePath, contentType: 'application/json' });
});

test('selecting an exhibit updates its plaque without replacing GPU textures', async ({ page }) => {
  await installMuseumApi(page);
  await installRendererProbe(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  const before = (await readRendererProbe(page)).at(-1)!;
  expect(Object.keys(before.labels)).toHaveLength(5);
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.frames).toBeGreaterThan(before.frames);
  expect((await readRendererProbe(page)).at(-1)!.labels).toEqual(before.labels);
});


