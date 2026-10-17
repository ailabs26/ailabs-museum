import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomResponseSchema } from '../src/validations/roomSchema';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';
import { writeFile } from 'node:fs/promises';

test('live private GLBs keep four healthy instances while one intercepted failure retries through the real backend', async ({ page }, testInfo) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires local backend with the five published Storage GLBs.');
  test.setTimeout(180_000);
  const response = await page.request.get('http://localhost:3001/api/rooms/bo-suu-tap-glb'); expect(response.status()).toBe(200);
  const room = roomResponseSchema(roomDetailSchema).parse(await response.json()).data;
  expect(room.exhibits.filter(item => item.model)).toHaveLength(5);
  const failed = room.exhibits[2]; const requests: Record<string, number> = {};
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const item = room.exhibits.find(item => request.url().includes(`/exhibits/${item.id}/model?`));
    if (item) requests[item.id] = (requests[item.id] ?? 0) + 1;
  });
  let intercepted = false;
  await page.route(`**/api/rooms/bo-suu-tap-glb/exhibits/${failed.id}/model?*`, async route => {
    if (intercepted) return route.continue(); intercepted = true;
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, data: null, message: 'Controlled read-only test failure' }),
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Credentials': 'true' } });
  });
  await installRendererProbe(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour.html?room=bo-suu-tap-glb'); await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 4/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 120_000 });
  const state = () => page.evaluate(() => {
    const models: Record<string, string> = {}, fallbacks: string[] = [], hotspots: string[] = [];
    window.museumProbe.at(-1)!.scene!.deref()!.traverse(object => {
      if (object.userData.modelLoaded) models[object.userData.artifactId] = object.uuid;
      if (object.userData.artifactFallback) fallbacks.push(object.userData.artifactId);
      if (object.userData.hotspotId) hotspots.push(object.userData.artifactId);
    }); return { models, fallbacks, hotspots };
  });
  const before = await state(); expect(Object.keys(before.models)).toHaveLength(4); expect(before.fallbacks).toEqual([failed.id]);
  expect(before.hotspots.sort()).toEqual(room.exhibits.map(item => item.id).sort());
  for (const item of room.exhibits) {
    const button = page.getByRole('button', { name: `Điểm tương tác ${item.name}`, exact: true });
    await button.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(item.description);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: `Điểm tương tác ${failed.name}`, exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('live-failure-placeholder.png'), fullPage: true });
  await page.getByRole('button', { name: `Thử lại ${failed.name}`, exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 60_000 });
  const after = await state(); expect(after.fallbacks).toEqual([]);
  for (const [id, uuid] of Object.entries(before.models)) expect(after.models[id]).toBe(uuid);
  for (const item of room.exhibits) expect(requests[item.id]).toBe(item.id === failed.id ? 2 : 1);
  expect(errors).toEqual([]);
  const profile = (await readRendererProbe(page)).at(-1)!;
  await writeFile(testInfo.outputPath('live-hotspot-evidence.json'), JSON.stringify({ before, after, requests, profile }, null, 2));
  await page.getByRole('button', { name: 'Dừng 3D' }).click();
  await expect.poll(async () => (await readRendererProbe(page)).filter(item => item.live).length).toBe(0);
});
