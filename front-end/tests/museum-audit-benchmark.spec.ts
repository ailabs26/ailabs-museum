import { expect, test, type Page } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { installMuseumApi } from './fixtures/museumApi';
import { analyzeMuseumAudit } from '../src/helpers/museumAuditMetrics';
import type { AuditMetadata } from '../src/helpers/museumAuditMetrics';
import { installRendererProbe, readRendererProbe, waitForGallerySurfaces, waitForRendererIdle } from './fixtures/museumProbe';
import { getAuditNavigationInput } from './fixtures/museumAuditRoute';

test.skip(process.env.MUSEUM_HARDWARE_AUDIT !== '1', 'Manual hardware audit only; never an FPS gate in CI/SwiftShader.');
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

function metadata(scenario: string, kind: AuditMetadata['kind'] = 'continuous'): AuditMetadata {
  return { buildSha: process.env.MUSEUM_AUDIT_SHA ?? '', device: process.env.MUSEUM_AUDIT_DEVICE ?? '',
    conditions: process.env.MUSEUM_AUDIT_CONDITIONS ?? '', scenario, kind, source: 'fixture', target: 'desktop' };
}

/** Real navigation input through the existing controller; no direct camera mutation/invalidate. */
async function navigate(page: Page, durationMs: number) {
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  const bounds = (await canvas.boundingBox())!;
  const x = bounds.x + bounds.width * .45, y = bounds.y + bounds.height * .48;
  await canvas.focus();
  await page.mouse.move(x, y); await page.mouse.down();
  const start = performance.now();
  let heldKey: string | null = null;
  try {
    while (performance.now() - start < durationMs) {
      const { key, lookX, lookY } = getAuditNavigationInput(performance.now() - start);
      if (key !== heldKey) { if (heldKey) await page.keyboard.up(heldKey); await page.keyboard.down(key); heldKey = key; }
      // Oscillating look plus lateral walk repeats the same bounded input route.
      await page.mouse.move(x + lookX * bounds.width, y + lookY * bounds.height);
      await page.waitForTimeout(16);
    }
  } finally { await page.keyboard.up('a'); await page.keyboard.up('d'); await page.mouse.up(); }
}

test('physical desktop fixture: repeated steady navigation and ten-minute session', async ({ page, headless }, info) => {
  test.setTimeout(900_000);
  expect(process.env.PLAYWRIGHT_PREVIEW).toBe('1');
  const output = process.env.MUSEUM_AUDIT_OUTPUT ?? info.outputPath('raw');
  await mkdir(output, { recursive: true });
  await installMuseumApi(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tour?museumAudit=1');
  await expect.poll(() => page.evaluate(() => !!window.museumAudit)).toBe(true);
  await page.getByRole('button', { name: 'Thu gọn audit' }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => window.museumAudit!.state().attachedRenderers)).toBe(1);
  await page.evaluate(meta => window.museumAudit!.start(meta), metadata('P03'));
  await navigate(page, 10_000);
  const warmup = await page.evaluate(() => window.museumAudit!.stop());
  const renderer = String(warmup.environment.renderer);
  expect(renderer).not.toMatch(/swiftshader|llvmpipe|software|microsoft basic render/i);
  expect(renderer).toMatch(/ANGLE|Apple|Intel|NVIDIA|AMD|Adreno|Mali/i);
  expect(warmup.resources.at(-1)!.textures).toBeGreaterThanOrEqual(14);
  expect(warmup.events.filter(event => event.type === 'workload').at(-1)!.detail.exhibits).toBe(5);
  await writeFile(join(output, 'desktop-environment.json'), JSON.stringify({ metadata: metadata('P03'), environment: warmup.environment,
    browser: page.context().browser()!.version(), headless, hardwareFlags: 'no forced software ANGLE; default Playwright Chromium flags',
    workload: 'museumContent.roomA: 5 illustrated exhibits, 0 GLB; alternating lateral keys every2s + sinusoidal mouse drag every~16ms',
    warmupMs: 10_000, presentedFrameRate: 'unavailable', gpuMemoryBytes: 'unavailable', gpuTimeMs: 'unavailable' }, null, 2));
  for (let run = 1; run <= 3; run++) {
    await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
    await navigate(page, 10_000);
    await page.getByLabel('Phòng trưng bày 3D').press('Home');
    await page.waitForTimeout(500);
    await page.evaluate(meta => window.museumAudit!.start(meta), metadata('P03'));
    await navigate(page, 30_000);
    const raw = await page.evaluate(() => window.museumAudit!.stop());
    await writeFile(join(output, `desktop-P03-run${run}.json`), JSON.stringify(raw));
    expect(raw.droppedSamples).toBe(0);
    console.log(`P03 run${run}: ${JSON.stringify(analyzeMuseumAudit(raw).frame)}`);
  }
  await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(output, 'desktop-fixture.png') });
  await page.evaluate(meta => window.museumAudit!.start(meta), metadata('P03', 'idle'));
  await page.waitForTimeout(30_000);
  const idle = await page.evaluate(() => window.museumAudit!.stop());
  await writeFile(join(output, 'desktop-idle.json'), JSON.stringify(idle));
  // Run a separate browser trace, whose overhead is excluded from primary captures.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,blink.user_timing,gpu', transferMode: 'ReturnAsStream' });
  await navigate(page, 10_000);
  const complete = new Promise<{ stream: string }>(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await complete;
  let trace = '';
  for (;;) {
    const chunk = await cdp.send('IO.read', { handle: stream });
    trace += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send('IO.close', { handle: stream });
  await writeFile(join(output, 'desktop-P03-profiler-trace.json.gz'), gzipSync(trace));
  await cdp.detach();
  if (process.env.MUSEUM_AUDIT_LONG_SESSION === '1') {
    await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
    await page.evaluate(meta => window.museumAudit!.start(meta), metadata('P07'));
    for (let minute = 1; minute <= 10; minute++) { await navigate(page, 60_000); console.log(`P07 elapsed ${minute} minutes`); }
    const raw = await page.evaluate(() => window.museumAudit!.stop());
    await writeFile(join(output, 'desktop-P07-10min.json'), JSON.stringify(raw));
    expect(raw.endedAt! - raw.startedAt).toBeGreaterThanOrEqual(600_000);
    expect(raw.droppedSamples).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('physical desktop fixture: startup, interactions and repeated lifecycle checkpoints', async ({ page }, info) => {
  test.setTimeout(240_000);
  const output = process.env.MUSEUM_AUDIT_OUTPUT ?? info.outputPath('raw');
  await mkdir(output, { recursive: true });
  await installMuseumApi(page); await installRendererProbe(page);
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
  const startup = [], switching = [], mounting = [], interactions = [];
  // Browser-level cold cache (not OS disk/GPU-driver cache), measured separately from warm reopen.
  await cdp.send('Network.clearBrowserCache');
  await page.goto('/tour?museumAudit=1');
  await expect(page.getByRole('button', { name: 'Thu gọn audit' })).toBeVisible();
  await page.getByRole('button', { name: 'Thu gọn audit' }).click();
  for (let cycle = 0; cycle < 10; cycle++) {
    const opener = page.getByRole('button', { name: 'Mở phòng 3D' });
    await opener.evaluate(button => button.addEventListener('click', () => performance.mark('audit-room-open'), { once: true }));
    await opener.click();
    const canvas = page.getByLabel('Phòng trưng bày 3D');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const canvasVisibleAt = await page.evaluate(() => performance.now());
    await waitForGallerySurfaces(page); await waitForRendererIdle(page);
    const beforeInput = (await readRendererProbe(page)).at(-1)!.frames;
    await canvas.press('ArrowRight');
    await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.frames).toBeGreaterThan(beforeInput);
    const usableAt = await page.evaluate(() => performance.now());
    const clickAt = await page.evaluate(() => performance.getEntriesByName('audit-room-open').at(-1)!.startTime);
    startup.push({ cycle, cache: cycle === 0 ? 'cold-browser-cache' : 'warm-reopen', clickToCanvasVisibleMs: canvasVisibleAt - clickAt,
      clickToVerifiedInteractionMs: usableAt - clickAt, note: 'includes deliberate1s idle check and automation; upper bound, not first-pixel presentation' });
    const initial = (await readRendererProbe(page)).at(-1)!;
    for (const index of [1, 2, 3, 4, 5]) {
      await page.getByRole('button', { name: `Lia camera tới Hiện vật ${index}`, exact: true }).click();
      await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
      await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
    }
    interactions.push({ cycle, selectedAndClosed: 5 });
    await page.getByRole('button', { name: 'Thoát tham quan' }).click();
    await expect.poll(async () => (await readRendererProbe(page)).filter(item => item.live).length).toBe(0);
    mounting.push({ cycle, initial, releasedHeapBytes: await heap(), liveContextsAfterClose: (await readRendererProbe(page)).filter(item => item.live).length });
  }
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  for (let cycle = 0; cycle < 10; cycle++) {
    const slug = cycle % 2 ? 'sculpture' : 'ceramics';
    await page.getByLabel('Chọn phòng trưng bày', { exact: true }).selectOption(slug);
    await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
    await waitForGallerySurfaces(page); await waitForRendererIdle(page);
    await expect.poll(async () => (await readRendererProbe(page)).filter(item => item.live).length).toBe(1);
    switching.push({ cycle, slug, renderer: (await readRendererProbe(page)).at(-1)! });
  }
  const footprintInventory = await page.evaluate(() => {
    const record = window.museumProbe.at(-1)!;
    const renderer = record.renderer.deref()!, scene = record.scene!.deref()! as import('three').Scene;
    const attributes = new Set<object>(), textures = new Set<import('three').Texture>();
    const targets: { width: number; height: number; depthBuffer: boolean; stencilBuffer: boolean; samples: number; format: number; type: number }[] = [];
    let attributeArrayBytes = 0;
    const attribute = (value: import('three').BufferAttribute | import('three').InterleavedBufferAttribute | null | undefined) => {
      if (!value) return;
      const buffer = 'isInterleavedBufferAttribute' in value ? value.data : value;
      if (!attributes.has(buffer)) { attributes.add(buffer); attributeArrayBytes += buffer.array.byteLength; }
    };
    if (scene.environment) textures.add(scene.environment);
    scene.traverse(object => {
      const mesh = object as import('three').Mesh;
      if (mesh.geometry) { Object.values(mesh.geometry.attributes).forEach(attribute); attribute(mesh.geometry.index); }
      const instance = object as import('three').InstancedMesh;
      if (instance.isInstancedMesh) { attribute(instance.instanceMatrix); attribute(instance.instanceColor); }
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const value of Object.values(material) as unknown[]) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
      }
      const light = object as import('three').DirectionalLight;
      if (light.isLight && light.shadow?.map) {
        const map = light.shadow.map;
        textures.add(map.texture);
        targets.push({ width: map.width, height: map.height, depthBuffer: map.depthBuffer, stencilBuffer: map.stencilBuffer,
          samples: map.samples, format: map.texture.format, type: map.texture.type });
      }
    });
    const gl = renderer.getContext();
    return { attributeArrayBytes, attributeBufferCount: attributes.size,
      gpuBufferInterpretation: 'Estimated GPU buffer-equivalent only if these attributes are uploaded; not driver allocation or total GPU memory.',
      textures: [...textures].map(texture => ({ name: texture.name, format: texture.format, type: texture.type, generateMipmaps: texture.generateMipmaps,
        width: typeof texture.image?.width === 'number' ? texture.image.width : null, height: typeof texture.image?.height === 'number' ? texture.image.height : null })),
      shadowTargets: targets, framebuffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight,
        samples: gl.getParameter(gl.SAMPLES), antialias: gl.getContextAttributes()?.antialias ?? null },
      totalGpuMemoryBytes: null };
  });
  await writeFile(join(output, 'desktop-lifecycle.json'), JSON.stringify({ buildSha: metadata('P08').buildSha,
    browser: page.context().browser()!.version(), source: 'fixture', startup, mounting, switching, interactions, footprintInventory,
    gpuMemoryBytes: 'unavailable', note: 'WeakRef probe + forced GC only in lifecycle experiment, excluded from steady-state FPS runs.' }, null, 2));
});
