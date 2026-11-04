import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe, readRendererProbe, waitForGallerySurfaces, waitForRendererIdle } from './fixtures/museumProbe';
import { analyzeMuseumAudit, museumAuditRunSchema } from '../src/helpers/museumAuditMetrics';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); await installRendererProbe(page); });

test('audit off loads no instrumentation, records nothing and preserves demand idle', async ({ page }) => {
  const auditModules: string[] = [];
  page.on('request', request => { if (/MuseumAudit|museumAuditBrowser/.test(request.url())) auditModules.push(request.url()); });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  await waitForGallerySurfaces(page);
  await waitForRendererIdle(page);
  const frames = (await readRendererProbe(page)).at(-1)!.frames;
  await page.waitForTimeout(1100);
  expect((await readRendererProbe(page)).at(-1)!.frames).toBe(frames);
  expect(await page.evaluate(() => Reflect.has(window, 'museumAudit'))).toBe(false);
  await expect(page.getByRole('group', { name: 'Performance audit' })).toHaveCount(0);
  expect(auditModules).toEqual([]);
});

test('opt-in exports actual submissions, stays idle and releases renderer observers across rooms', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tour?museumAudit=1');
  const panel = page.getByRole('group', { name: 'Performance audit' });
  await expect(panel).toBeVisible();
  await panel.getByLabel('Build SHA').fill('a'.repeat(40));
  await panel.getByLabel('Thiết bị').fill('automated SwiftShader fixture');
  await panel.getByLabel('Điều kiện đo').fill('regression only; not physical GPU');
  await panel.getByLabel('Data source').selectOption('fixture');
  await panel.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  await waitForGallerySurfaces(page);
  await waitForRendererIdle(page);
  await expect.poll(() => page.evaluate(() => window.museumAudit?.state().attachedRenderers)).toBe(1);
  const frames = (await readRendererProbe(page)).at(-1)!.frames;
  const samples = await page.evaluate(() => window.museumAudit!.snapshot()!.frames.length);
  await page.waitForTimeout(1100);
  expect((await readRendererProbe(page)).at(-1)!.frames).toBe(frames);
  expect(await page.evaluate(() => window.museumAudit!.snapshot()!.frames.length)).toBe(samples);
  await page.getByLabel('Phòng trưng bày 3D').press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.museumAudit!.snapshot()!.frames.length)).toBeGreaterThan(samples);
  await page.getByLabel('Chọn phòng trưng bày', { exact: true }).selectOption('ceramics');
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  await waitForGallerySurfaces(page);
  await waitForRendererIdle(page);
  await expect.poll(() => page.evaluate(() => window.museumAudit!.state().attachedRenderers)).toBe(1);
  await panel.getByRole('button', { name: 'Stop', exact: true }).click();
  const raw = await page.evaluate(() => window.museumAudit!.snapshot());
  expect(museumAuditRunSchema.safeParse(raw).success).toBe(true);
  expect(raw!.events.some(event => event.type === 'renderer-detached')).toBe(true);
  expect(new Set(raw!.frames.map(frame => frame[2])).size).toBe(2);
  expect(analyzeMuseumAudit(raw).eligible).toBe(false); // Short fixture regression is never an FPS gate.
  const count = raw!.frames.length;
  await page.getByLabel('Phòng trưng bày 3D').press('ArrowLeft');
  expect((await page.evaluate(() => window.museumAudit!.snapshot()))!.frames).toHaveLength(count);
  const downloadPromise = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(raw);
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  await expect.poll(() => page.evaluate(() => window.museumAudit!.state().attachedRenderers)).toBe(0);
  expect(await page.evaluate(() => window.museumAudit!.state().observing)).toBe(false);
  await page.goto('/collection');
  expect(await page.evaluate(() => Reflect.has(window, 'museumAudit'))).toBe(false);
});

test('audit controls and navigation remain reachable on emulated touch after orientation change', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tour?museumAudit=1');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Thu gọn audit' }).click();
  await page.getByLabel('Phòng trưng bày 3D').press('ArrowRight');
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
});
