import { expect, test, type Page } from '@playwright/test';
import { installFiveModels } from './fixtures/museumGlb';
import { aimXr, installXrSimulation } from './fixtures/museumXr';
import { installRendererProbe, readRendererProbe, waitForRendererIdle } from './fixtures/museumProbe';
import { museumExhibitButton, selectMuseumExhibit } from './fixtures/museumUi';

const canvasName = 'Phòng trưng bày 3D';
const phase = (page: Page, value: string) => page.locator(`[data-xr-phase="${value}"]`);
const pageErrors = new WeakMap<Page, string[]>();

async function openRoom(page: Page) {
  await page.goto('/tour.html?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 20_000 });
}

async function enter(page: Page) {
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect(phase(page, 'active')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.museumXrFixture.listeners.at(-1)?.select)).toBe(2);
}

async function assertReleased(page: Page) {
  await expect.poll(() => page.evaluate(() => window.museumXrFixture.listeners.map(counts =>
    Object.values(counts).reduce((sum, count) => sum + count, 0)))).toEqual(
    await page.evaluate(() => window.museumXrFixture.sessions.map(() => 0)),
  );
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await installRendererProbe(page);
  await page.addInitScript(() => {
    Reflect.set(window, 'xrRejections', []);
    window.addEventListener('unhandledrejection', event => Reflect.get(window, 'xrRejections').push(String(event.reason)));
  });
});

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return;
  const evidence = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    timeline: window.museumXrFixture?.timeline, listeners: window.museumXrFixture?.listeners,
    requests: window.museumXrFixture?.requests, ends: window.museumXrFixture?.ends,
    endCalls: window.museumXrFixture?.endCalls, rejections: Reflect.get(window, 'xrRejections'),
    webgl: document.querySelector('[data-webgl-status]')?.getAttribute('data-webgl-status'),
    xr: document.querySelector('[data-xr-phase]')?.getAttribute('data-xr-phase'),
  }));
  await info.attach('xr-lifecycle.json', { body: JSON.stringify({ ...evidence, errors: pageErrors.get(page), renderers: await readRendererProbe(page) }, null, 2), contentType: 'application/json' });
  expect(evidence.rejections).toEqual([]);
  expect(pageErrors.get(page)).toEqual([]);
});

for (const order of ['end-first', 'device-first'] as const) {
  test(`F11 F16 F18 native mid-session headset disconnect and fresh reconnect, ${order}`, async ({ page }, info) => {
    // Four deliberate sessions plus three web-navigation/idle checks share the
    // existing XR suite's 60s browser budget. Product recovery deadlines stay fixed.
    test.setTimeout(60_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await installXrSimulation(page);
    const { requests, exhibits } = await installFiveModels(page);
    await openRoom(page);
    await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
    await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
    await waitForRendererIdle(page);
    const saved = await page.evaluate(() => {
      const camera = window.museumProbe.at(-1)!.camera!.deref()!;
      return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() };
    });
    const canvas = page.getByLabel(canvasName, { exact: true });
    await canvas.evaluate(node => { node.dataset.identity = 'before-disconnect'; });
    const samples = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      // Alternate actual XR targets so every new session must change selection,
      // without repeating catalogue/focus setup in the web recovery interval.
      const selection = exhibits[[4, 2, 4][cycle]];
      await enter(page);
      const point = await page.evaluate(id => {
        const record = window.museumProbe.at(-1)!, scene = record.scene!.deref()!;
        scene.updateMatrixWorld(true);
        let point: number[] | undefined;
        scene.traverse(object => {
          if (object.userData.museumLabel && object.parent?.userData.artifactId === id) point = object.getWorldPosition(record.camera!.deref()!.position.clone()).toArray();
        });
        if (!point) throw new Error('Expected a rendered exhibit label');
        return point;
      }, selection.id);
      await aimXr(page, point);
      await page.evaluate(() => window.museumXrFixture.select());
      await expect(museumExhibitButton(page, `Xem chi tiết ${selection.name}`)).toHaveAttribute('aria-pressed', 'true');
      samples.push({ stage: `active-${cycle}`, target: { id: selection.id, point }, requests: [...requests], renderers: await readRendererProbe(page) });
      await page.evaluate(order => window.museumXrFixture.terminateHeadset(order), order);
      await expect(phase(page, 'idle')).toBeVisible();
      await assertReleased(page);
      await expect(page.getByRole('button', { name: 'Enter VR', exact: true })).toHaveCount(0);
      await expect(canvas).toHaveAttribute('data-identity', 'before-disconnect');
      await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(selection.name);
      expect(await page.evaluate(() => {
        const camera = window.museumProbe.at(-1)!.camera!.deref()!;
        return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() };
      })).toEqual(saved);
      const beforeWebFrame = (await readRendererProbe(page)).at(-1)!.frames;
      await canvas.press('ArrowRight');
      await expect.poll(() => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.quaternion.toArray())).not.toEqual(saved.quaternion);
      await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.frames).toBeGreaterThan(beforeWebFrame);
      await canvas.press('Home');
      await waitForRendererIdle(page);
      // Duplicate native signals from an old session must be inert.
      await page.evaluate(() => window.museumXrFixture.sessions.at(-1)!.dispatchEvent(new Event('end')));
      await page.evaluate(() => window.museumXrFixture.setAvailable(true));
      await expect(page.getByRole('button', { name: 'Enter VR', exact: true })).toBeEnabled();
      expect(await page.evaluate(() => window.museumXrFixture.requests)).toBe(cycle + 1);
      await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true })).toBeEnabled();
      samples.push({ stage: `web-${cycle}`, requests: [...requests], renderers: await readRendererProbe(page) });
    }
    await enter(page);
    await page.evaluate(() => window.museumXrFixture.sessions[0].dispatchEvent(new Event('end')));
    await expect(phase(page, 'active')).toBeVisible();
    expect(await page.evaluate(() => new Set(window.museumXrFixture.sessions).size)).toBe(4);
    await page.getByRole('button', { name: 'Exit VR', exact: true }).click();
    await expect(phase(page, 'idle')).toBeVisible();
    await assertReleased(page);
    expect(requests).toEqual([1, 1, 1, 1, 1]);
    expect(await page.evaluate(() => window.museumXrFixture.endCalls)).toBe(1);
    expect((await readRendererProbe(page)).filter(record => record.live)).toHaveLength(1);
    const resources = samples.filter(sample => sample.stage.startsWith('web')).map(sample => sample.renderers.at(-1)!);
    expect(resources.map(record => record.geometries)).toEqual(Array(3).fill(resources[0].geometries));
    expect(resources.map(record => record.textures)).toEqual(Array(3).fill(resources[0].textures));
    await page.screenshot({ path: info.outputPath('recovered.png') });
    await info.attach('disconnect-samples.json', { body: JSON.stringify({ saved, samples, errors }, null, 2), contentType: 'application/json' });
    await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(async () => (await readRendererProbe(page)).filter(record => record.live).length).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('F13 blurred visibility ignores select and snap-turn, hidden ends the session', async ({ page }) => {
  await installXrSimulation(page); await installFiveModels(page); await openRoom(page);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2'); await enter(page);
  await aimXr(page, [1.8, 3.16, 2]);
  const before = await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.rotation.y);
  await page.evaluate(() => { window.museumXrFixture.visibility('visible-blurred'); window.museumXrFixture.axes[2] = 0.9; window.museumXrFixture.select(); });
  // Two native scheduling boundaries demonstrate that frames continue while input is suspended.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(phase(page, 'active')).toBeVisible();
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 2')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.parent!.rotation.y)).toBe(before);
  await page.evaluate(() => { window.museumXrFixture.axes[2] = 0; window.museumXrFixture.visibility('visible'); window.museumXrFixture.select(); });
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 5')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.museumXrFixture.visibility('hidden'));
  await expect(phase(page, 'idle')).toBeVisible(); await assertReleased(page);
});

test('F14 native termination before a pending request is delivered never binds the ended session', async ({ page }) => {
  await installXrSimulation(page, { holdRequest: true }); await installFiveModels(page); await openRoom(page);
  await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!window.museumXrFixture.finishRequest)).toBe(true);
  await page.evaluate(() => { window.museumXrFixture.terminateHeadset(); window.museumXrFixture.finishRequest!(); });
  await expect(phase(page, 'idle')).toBeVisible(); await assertReleased(page);
  expect(await page.evaluate(() => window.museumXrFixture.timeline.map(item => item.event))).not.toContain('binding:start');
  expect(await page.evaluate(() => window.museumXrFixture.ends)).toBe(1);
  expect(await page.evaluate(() => window.museumProbe.at(-1)!.renderer.deref()!.xr.isPresenting)).toBe(false);
});

test('F16 rapid disconnect and reconnect rechecks capability without automatic entry', async ({ page }) => {
  await installXrSimulation(page); await installFiveModels(page); await openRoom(page); await enter(page);
  await page.evaluate(() => { window.museumXrFixture.terminateHeadset(); window.museumXrFixture.setAvailable(true); });
  await expect(phase(page, 'idle')).toBeVisible(); await assertReleased(page);
  await expect(page.getByRole('button', { name: 'Enter VR', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.museumXrFixture.requests)).toBe(1);
  await enter(page);
  await page.evaluate(() => window.museumXrFixture.sessions[0].dispatchEvent(new Event('end')));
  await expect(phase(page, 'active')).toBeVisible();
  expect(await page.evaluate(() => window.museumXrFixture.requests)).toBe(2);
  await page.getByRole('button', { name: 'Exit VR', exact: true }).click();
  await expect(phase(page, 'idle')).toBeVisible(); await assertReleased(page);
});

for (const boundary of ['compatibility', 'binding'] as const) {
  test(`F14 native end during pending ${boundary} cannot resurrect presentation`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await installXrSimulation(page, boundary === 'binding' ? { holdBinding: true } : { holdCompatibility: true });
    await installFiveModels(page); await openRoom(page);
    await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
    await expect.poll(() => page.evaluate(boundary => !!(boundary === 'binding' ? window.museumXrFixture.finishBinding : window.museumXrFixture.finishCompatibility), boundary)).toBe(true);
    await page.evaluate(boundary => {
      window.museumXrFixture.terminateHeadset();
      window.museumXrFixture.sessions[0].dispatchEvent(new Event('end'));
      if (boundary === 'binding') window.museumXrFixture.finishBinding!();
      else window.museumXrFixture.finishCompatibility!();
    }, boundary);
    await expect(phase(page, 'idle')).toBeVisible(); await assertReleased(page);
    expect(await page.evaluate(() => window.museumProbe.at(-1)!.renderer.deref()!.xr.isPresenting)).toBe(false);
    await expect(page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

for (const action of ['close', 'room'] as const) {
  test(`F17 ${action} while native request is pending ends the late session without binding`, async ({ page }) => {
    await installXrSimulation(page, { holdRequest: true }); await installFiveModels(page); await openRoom(page);
    await page.getByLabel(canvasName, { exact: true }).evaluate(node => { node.dataset.pendingOwner = 'old-room'; });
    await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!window.museumXrFixture.finishRequest)).toBe(true);
    if (action === 'close') await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
    else await page.getByLabel('Chọn phòng trưng bày').selectOption('empty');
    await expect(page.locator('canvas[data-pending-owner="old-room"]')).toHaveCount(0);
    await page.evaluate(() => window.museumXrFixture.finishRequest!());
    await expect.poll(() => page.evaluate(() => window.museumXrFixture.endCalls)).toBe(1);
    expect(await page.evaluate(() => window.museumXrFixture.ends)).toBe(1);
    const events = await page.evaluate(() => window.museumXrFixture.timeline.map(item => item.event));
    expect(events.indexOf('app:end')).toBeLessThan(events.indexOf('native:end'));
    expect(events).not.toContain('binding:start');
    await assertReleased(page);
    await expect.poll(async () => (await readRendererProbe(page)).filter(record => record.live).length).toBe(action === 'close' ? 0 : 1);
    if (action === 'room') {
      await expect(phase(page, 'idle')).toBeVisible();
      expect(await page.evaluate(() => window.museumProbe.at(-1)!.renderer.deref()!.xr.isPresenting)).toBe(false);
    }
  });
}

for (const duringBinding of [false, true]) for (const order of ['native-first', 'context-first'] as const) {
  test(`F15 real context loss with native termination, binding=${duringBinding}, ${order}`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await installXrSimulation(page, { holdBinding: duringBinding }); await installFiveModels(page); await openRoom(page);
    await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
    if (duringBinding) await expect.poll(() => page.evaluate(() => !!window.museumXrFixture.finishBinding)).toBe(true);
    else await expect(phase(page, 'active')).toBeVisible();
    await page.getByLabel(canvasName, { exact: true }).evaluate((canvas: HTMLCanvasElement, order) => {
      const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
      Reflect.set(window, 'restoreMatrixContext', () => extension.restoreContext()); extension.loseContext();
      if (order === 'native-first') { window.museumXrFixture.terminateHeadset(); window.museumXrFixture.finishBinding?.(); }
    }, order);
    if (order === 'context-first') {
      await expect(page.locator('[data-webgl-status="recovering"]')).toBeVisible();
      await page.evaluate(() => { window.museumXrFixture.terminateHeadset(); window.museumXrFixture.finishBinding?.(); });
    }
    await expect(page.locator('[data-webgl-status="recovering"]')).toBeVisible();
    await page.evaluate(() => Reflect.get(window, 'restoreMatrixContext')());
    await expect(page.locator('[data-webgl-status="ready"][data-xr-phase="idle"]')).toBeVisible();
    await assertReleased(page); expect(errors).toEqual([]);
  });
}

test('F04 F18 three partial binding failures exhaust the Canvas reset budget into readable 2D', async ({ page }) => {
  // Three cold Canvas creations use the same native-reset readiness gate as
  // museum-xr.spec.ts, rather than assuming a software GPU starts within 5s.
  test.setTimeout(60_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await installXrSimulation(page, { failBinding: true });
  const { requests, exhibits } = await installFiveModels(page); await openRoom(page);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.museumXrFixture.ends)).toBe(attempt);
    if (attempt < 3) {
      await expect.poll(() => page.evaluate(() => window.museumProbe.length), { timeout: 15_000 }).toBe(attempt + 1);
      await expect(page.locator('[data-webgl-status="ready"][data-xr-phase="idle"]')).toBeVisible();
      await expect.poll(async () => (await readRendererProbe(page)).filter(record => record.live).length).toBe(1);
    }
  }
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D', exact: true })).toHaveAttribute('href', `/collection/sculpture/exhibits/${exhibits[1].id}`);
  await expect(museumExhibitButton(page, 'Xem chi tiết Hiện vật 2')).toHaveAttribute('aria-pressed', 'true');
  expect(requests).toEqual([1, 1, 1, 1, 1]); expect(errors).toEqual([]);
  await expect.poll(async () => (await readRendererProbe(page)).filter(record => record.live).length).toBe(0);
  expect(await page.evaluate(() => window.museumProbe.length)).toBe(3);
});
