import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ModelLodSet } from '../src/helpers/modelLod';
import type { PublicModel } from '../src/validations/roomSchema';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

interface Artifact {
  file: string; lod: 0 | 1 | 2; sha256: string; bytes: number;
  metrics: { triangles: number; vertices: number };
  quality: { visual: string; relativeSurfaceError: number };
}
interface FixtureConfig { source: PublicModel; lodSet?: ModelLodSet }

const item = roomA.exhibits[0];
const normalization = { scale: 0.9, offset: [-2, 1, 3] as [number, number, number],
  size: [1.8, 1.8, 1.8] as [number, number, number], center: [0, 0.9, 0] as [number, number, number], radius: Math.sqrt(3) * 0.9 };
let directory = '';
let source: PublicModel;
let embeddedWebpModel: PublicModel;
let artifacts: Artifact[];
let lodSet: ModelLodSet;
const binaries = new Map<string, Buffer>();

function descriptor(bytes: Buffer, name: string): PublicModel {
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  return { id: item.id, storageKey: `models/${name}.glb`, checksumSha256, sizeBytes: bytes.length,
    url: `/rooms/sculpture/exhibits/${item.id}/model?version=${checksumSha256}` };
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const parent = resolve('tmp');
  await mkdir(parent, { recursive: true });
  directory = await mkdtemp(join(parent, 'asset-pipeline-browser-'));
  const fixture = await import(pathToFileURL(resolve('../tools/asset-pipeline/test/fixture.mjs')).href);
  const optimizer = await import(pathToFileURL(resolve('../tools/asset-pipeline/src/optimizer.mjs')).href);
  const master = join(directory, 'source.glb');
  await fixture.createFixture(master);
  const manifest = await optimizer.optimizeAsset({ source: master, output: join(directory, 'candidate'), embeddedWebp: false });
  artifacts = manifest.artifacts as Artifact[];
  expect(artifacts.map(artifact => artifact.lod)).toEqual([0, 1, 2]);
  const original = await readFile(master);
  source = descriptor(original, 'synthetic-original');
  binaries.set(source.checksumSha256, original);
  const levels = await Promise.all(artifacts.map(async artifact => {
    const bytes = await readFile(join(directory, 'candidate', artifact.file));
    const model = descriptor(bytes, `synthetic-lod${artifact.lod}`);
    expect(model.checksumSha256).toBe(artifact.sha256);
    binaries.set(model.checksumSha256, bytes);
    return { level: artifact.lod, model };
  }));
  lodSet = { usage: 'fixture', sourceChecksumSha256: source.checksumSha256, normalization,
    thresholds: { lod0Pixels: 380, lod1Pixels: 120, hysteresis: 0.15 }, levels };
  const embedded = await optimizer.optimizeAsset({ source: master, output: join(directory, 'embedded-webp'), embeddedWebp: true });
  const webpArtifact = embedded.artifacts.find((artifact: Artifact) => artifact.lod === 0);
  const webpBytes = await readFile(join(directory, 'embedded-webp', webpArtifact.file));
  embeddedWebpModel = descriptor(webpBytes, 'synthetic-embedded-webp');
  binaries.set(embeddedWebpModel.checksumSha256, webpBytes);
});

test.afterAll(async () => {
  // mkdtemp creates only this suite-owned directory under front-end/tmp.
  if (directory.startsWith(resolve('tmp', 'asset-pipeline-browser-'))) await rm(directory, { recursive: true, force: true });
});

async function installBinaries(page: Page, options: { delayedLevel?: number; gate?: Promise<void>; failLevel?: number } = {}) {
  const requests: string[] = [];
  await page.route('**/rooms/sculpture/exhibits/*/model?*', async route => {
    const checksum = new URL(route.request().url()).searchParams.get('version') ?? '';
    requests.push(checksum);
    const level = lodSet.levels.find(value => value.model.checksumSha256 === checksum)?.level;
    if (options.delayedLevel !== undefined && level === options.delayedLevel) await options.gate;
    if (options.failLevel !== undefined && level === options.failLevel) return route.abort('failed');
    const body = binaries.get(checksum);
    if (!body) return route.fulfill({ status: 404, body: 'Unknown fixture' });
    await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body,
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true' } });
  });
  return requests;
}

async function installHarness(page: Page, config: FixtureConfig, options: Parameters<typeof installBinaries>[1] = {}) {
  await installRendererProbe(page);
  await page.route('**/tests/fixtures/asset-pipeline-data.json', route => route.fulfill({ json: config }));
  return installBinaries(page, options);
}

async function readyLevel(page: Page, level: number) {
  const status = page.getByTestId('asset-status');
  await expect(status).toHaveText('ready', { timeout: 60_000 });
  await expect(status).toHaveAttribute('data-level', String(level), { timeout: 60_000 });
  await expect.poll(async () => (await artifactState(page)).loaded).toBe(1);
}

async function artifactState(page: Page) {
  return page.evaluate(() => {
    let loaded = 0;
    const hotspots: number[][] = [];
    const normalizations: unknown[] = [];
    const scene = window.museumProbe.at(-1)?.scene?.deref();
    scene?.traverse(object => {
      if (object.userData.modelLoaded) { loaded++; normalizations.push(object.userData.normalization); }
      if (object.userData.hotspotId === 'pipeline-hotspot') hotspots.push(object.position.toArray());
    });
    return { loaded, hotspots, normalizations };
  });
}

async function waitForFixtureSurfaces(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const textures = new Set<string>();
    window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => {
      const material = (object as import('three').Mesh).material;
      for (const item of !material ? [] : Array.isArray(material) ? material : [material]) {
        const surface = item as import('three').MeshStandardMaterial;
        for (const map of [surface.map, surface.normalMap, surface.roughnessMap]) {
          if (map?.name && map.image?.width === 512) textures.add(map.name);
        }
      }
    });
    return [...textures].sort();
  })).toEqual(['contact-shadow', 'limestone-color', 'limestone-normal', 'limestone-roughness']);
}

async function saveBrowserEvidence(page: Page, testInfo: TestInfo, values: unknown) {
  const environment = await page.evaluate(() => {
    const renderer = window.museumProbe.at(-1)?.renderer.deref();
    const gl = renderer?.getContext();
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
      renderer: gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      scope: 'Synthetic fixture, Edge/Chromium software WebGL regression. No physical-device FPS or VRAM claim.' };
  });
  await writeFile(testInfo.outputPath('browser-measurements.json'), JSON.stringify({ environment,
    source: { checksum: source.checksumSha256, bytes: source.sizeBytes }, artifacts,
    renderer: await readRendererProbe(page), measurements: values, visualQa: 'REVIEW_REQUIRED' }, null, 2));
}

for (const decoder of ['wasm', 'js'] as const) test(`generated Draco loads in the public museum using self-hosted ${decoder} decoder`, async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const decoderResponses: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (/draco_(decoder|wasm_wrapper)/.test(response.url()) && response.ok()) decoderResponses.push(response.url()); });
  if (decoder === 'js') await page.addInitScript(() => { Object.defineProperty(window, 'WebAssembly', { value: undefined, configurable: true }); });
  await installRendererProbe(page);
  await installMuseumApi(page);
  const compressed = lodSet.levels[0].model;
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{ ...item, model: compressed }] })));
  await installBinaries(page);
  const started = Date.now();
  await page.goto('/tour.html');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByText('Đã tải 1/1 mô hình 3D', { exact: true })).toBeVisible({ timeout: 60_000 }).catch(async error => {
    const diagnostic = { errors, decoderResponses, body: await page.locator('body').innerText() };
    await testInfo.attach('public-model-failure.json', { body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json' });
    throw error;
  });
  const readyUpperBoundMs = Date.now() - started;
  await expect.poll(async () => (await readRendererProbe(page)).at(-1)?.triangles ?? 0).toBeGreaterThan(0);
  expect(decoderResponses.some(url => decoder === 'wasm' ? /draco_decoder.*\.wasm/.test(url) : /draco_decoder.*\.js/.test(url))).toBe(true);
  expect(decoderResponses.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
  expect(errors).toEqual([]);
  await page.getByLabel('Phòng trưng bày 3D', { exact: true }).screenshot({ path: testInfo.outputPath(`public-draco-${decoder}.png`) });
  await saveBrowserEvidence(page, testInfo, { readyUpperBoundMs, timingScope: 'navigation through DOM model-ready indication, includes application and automation', decoderResponses });
});

test('CMS Preview renders generated Draco and legacy GLB with shared validation', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let config: FixtureConfig = { source: lodSet.levels[0].model };
  await installRendererProbe(page);
  await page.route('**/tests/fixtures/asset-pipeline-data.json', route => route.fulfill({ json: config }));
  await installBinaries(page);
  for (const [name, model] of [['draco', lodSet.levels[0].model], ['legacy', source], ['embedded-webp', embeddedWebpModel]] as const) {
    config = { source: model };
    await page.goto('/tests/fixtures/asset-pipeline.html?preview=1');
    await expect(page.getByRole('img', { name: 'Xem trước mô hình 3D' })).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await readRendererProbe(page)).at(-1)?.triangles ?? 0).toBeGreaterThan(0);
    await page.getByRole('img', { name: 'Xem trước mô hình 3D' }).screenshot({ path: testInfo.outputPath(`cms-${name}.png`) });
  }
  expect(errors).toEqual([]);
});

test('missing decoder produces an isolated model fallback with no unhandled rejection', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await installHarness(page, { source: lodSet.levels[0].model });
  let failedDecoderRequests = 0;
  await page.route('**/*draco_decoder*.wasm*', route => {
    // Vite's ?url module is an application script. Fail the decoder's actual binary fetch.
    if (route.request().resourceType() !== 'fetch') return route.continue();
    failedDecoderRequests++;
    return route.abort('failed');
  });
  await page.goto('/tests/fixtures/asset-pipeline.html');
  await expect(page.getByTestId('asset-status')).toHaveText('error', { timeout: 60_000 });
  await expect(page.getByLabel('Asset fixture canvas')).toBeVisible();
  expect((await artifactState(page)).loaded).toBe(0);
  expect(failedDecoderRequests).toBe(1);
  expect(errors).toEqual([]);
});

for (const decoder of ['wasm', 'js'] as const) test(`worker allocation limit returns a safe fallback with the ${decoder} decoder`, async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  if (decoder === 'js') await page.addInitScript(() => { Object.defineProperty(window, 'WebAssembly', { value: undefined, configurable: true }); });
  await page.route('**/*draco*.js*', async route => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    const response = await route.fetch();
    // Exercise allocation inside the actual worker before its native geometry decode.
    const body = `${await response.text()}
      var originalDracoFactory = DracoDecoderModule;
      DracoDecoderModule = function(config) {
        var loaded = config.onModuleLoaded;
        config.onModuleLoaded = function(module) {
          var decode = module.Decoder.prototype.DecodeArrayToMesh;
          module.Decoder.prototype.DecodeArrayToMesh = function() {
            module._malloc(128 * 1024 * 1024 + 1);
            return decode.apply(this, arguments);
          };
          loaded(module);
        };
        return originalDracoFactory(config);
      };
    `;
    await route.fulfill({ response, body });
  });
  await installHarness(page, { source: lodSet.levels[0].model });
  await page.goto('/tests/fixtures/asset-pipeline.html');
  await expect(page.getByTestId('asset-status')).toHaveText('error', { timeout: 60_000 });
  expect((await artifactState(page)).loaded).toBe(0);
  await expect(page.getByLabel('Asset fixture canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('corrupt Draco payload fails through the native decoder without crashing the scene', async ({ page }) => {
  const bytes = Buffer.from(binaries.get(lodSet.levels[0].model.checksumSha256)!);
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const compressedView = document.bufferViews[document.meshes[0].primitives[0].extensions.KHR_draco_mesh_compression.bufferView];
  const start = 28 + jsonLength + (compressedView.byteOffset ?? 0);
  bytes.fill(0, start, start + compressedView.byteLength);
  const damaged = descriptor(bytes, 'corrupt-draco-payload');
  binaries.set(damaged.checksumSha256, bytes);
  const errors: string[] = [];
  let loadedDecoder = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (/draco_decoder.*\.wasm/.test(response.url()) && response.ok()) loadedDecoder = true;
  });
  await installHarness(page, { source: damaged });
  await page.goto('/tests/fixtures/asset-pipeline.html');
  await expect(page.getByTestId('asset-status')).toHaveText('error', { timeout: 60_000 });
  expect(loadedDecoder).toBe(true);
  expect((await artifactState(page)).loaded).toBe(0);
  await expect(page.getByLabel('Asset fixture canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('screen-space LOD requests independent files, retains a delayed upgrade and preserves picking and hotspots', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let releaseUpgrade!: () => void;
  const gate = new Promise<void>(resolveGate => { releaseUpgrade = resolveGate; });
  const requests = await installHarness(page, { source, lodSet }, { delayedLevel: 0, gate });
  await page.goto('/tests/fixtures/asset-pipeline.html');
  await readyLevel(page, 2);
  expect(requests).toEqual([lodSet.levels[2].model.checksumSha256]);
  const initial = await artifactState(page);
  expect(initial.loaded).toBe(1);
  expect(initial.hotspots).toHaveLength(1);
  await page.getByRole('button', { name: 'Medium', exact: true }).click();
  await readyLevel(page, 1);
  await page.getByRole('button', { name: 'Near', exact: true }).click();
  await expect.poll(() => requests.includes(lodSet.levels[0].model.checksumSha256)).toBe(true);
  await readyLevel(page, 1);
  expect((await artifactState(page)).loaded).toBe(1);
  releaseUpgrade();
  await readyLevel(page, 0);
  expect(await artifactState(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Far', exact: true }).click();
  await readyLevel(page, 2);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await readyLevel(page, 0);
  await page.getByRole('button', { name: 'Unselect', exact: true }).click();
  await readyLevel(page, 2);
  await page.getByRole('button', { name: 'Near', exact: true }).click();
  await readyLevel(page, 0);
  const canvas = page.getByLabel('Asset fixture canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('selection')).toHaveText('selected');
  expect(new Set(requests).size).toBe(3);
  // One inactive variant per family can be evicted and requested again.
  expect(requests.filter(checksum => checksum === lodSet.levels[0].model.checksumSha256)).toHaveLength(1);
  expect(errors).toEqual([]);
  await saveBrowserEvidence(page, testInfo, { requests, initial, final: await artifactState(page) });
});

test('slotted gallery preserves all five plinths while the occupied slot upgrades LOD', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = await installHarness(page, { source, lodSet });
  await page.goto('/tests/fixtures/asset-pipeline.html?slotted=1');
  await readyLevel(page, 2);
  await expect.poll(() => page.evaluate(() => {
    const slots: string[] = [];
    window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => {
      if (typeof object.userData.gallerySlot === 'string') slots.push(object.userData.gallerySlot);
    });
    return slots.sort();
  })).toEqual(['S01', 'S02', 'S03', 'S04', 'S05']);
  const initial = await artifactState(page);
  await page.getByRole('button', { name: 'Medium', exact: true }).click();
  await readyLevel(page, 1);
  await page.getByRole('button', { name: 'Near', exact: true }).click();
  await readyLevel(page, 0);
  expect(await artifactState(page)).toEqual(initial);
  expect(new Set(requests).size).toBe(3);
  expect(errors).toEqual([]);
});

test('LOD upgrade network failure keeps visible geometry and room teardown disposes owned resources', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  const failedModels: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => { if (request.url().includes('/model?')) failedModels.push(request.url()); });
  const requests = await installHarness(page, { source, lodSet }, { failLevel: 0 });
  await page.goto('/tests/fixtures/asset-pipeline.html');
  await readyLevel(page, 2);
  const initial = await artifactState(page);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect.poll(() => failedModels.length).toBe(1);
  await readyLevel(page, 0);
  expect(requests).toContain(source.checksumSha256);
  expect(await artifactState(page)).toEqual(initial);
  const disposal = page.evaluate(() => new Promise<number>(resolveDisposal => {
    let count = 0;
    const geometries = new Set<import('three').BufferGeometry>();
    window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => {
      const mesh = object as import('three').Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
    });
    for (const geometry of geometries) geometry.addEventListener('dispose', () => count++);
    setTimeout(() => resolveDisposal(count), 2000);
  }));
  await page.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(page.getByTestId('unmounted')).toBeVisible();
  expect(await disposal).toBeGreaterThan(0);
  await expect.poll(async () => (await readRendererProbe(page)).filter(renderer => renderer.live).length).toBe(0);
  await page.getByRole('button', { name: 'Remount', exact: true }).click();
  await readyLevel(page, 0);
  // Selection requests LOD0, whose deliberate network failure falls back to legacy source.
  expect((await artifactState(page)).loaded).toBe(1);
  expect(errors).toEqual([]);
  await saveBrowserEvidence(page, testInfo, { initial, afterRemount: await artifactState(page), disposalObserved: true });
});

test('fixed-camera synthetic original and LOD screenshots retain shared normalization', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  let config: FixtureConfig = { source };
  await installRendererProbe(page);
  await page.route('**/tests/fixtures/asset-pipeline-data.json', route => route.fulfill({ json: config }));
  await installBinaries(page);
  const snapshots: unknown[] = [];
  for (const [name, model, level] of [['original', source, 0], ...lodSet.levels.map(value => [`lod${value.level}`, value.model, value.level])] as [string, PublicModel, 0 | 1 | 2][]) {
    config = { source: model, lodSet: { ...lodSet, sourceChecksumSha256: model.checksumSha256, levels: [{ level, model }] } };
    await page.goto('/tests/fixtures/asset-pipeline.html?capture=1');
    await readyLevel(page, level);
    await waitForFixtureSurfaces(page);
    await expect.poll(async () => (await artifactState(page)).loaded).toBe(1);
    await page.getByLabel('Asset fixture canvas').screenshot({ path: testInfo.outputPath(`${name}-fixed-camera.png`) });
    const state = await artifactState(page);
    expect(state.normalizations).toEqual([normalization]);
    const samples: unknown[] = [];
    for (let sample = 0; sample < 3; sample++) {
      await page.getByRole('button', { name: 'Measure', exact: true }).click();
      await expect(page.getByTestId('measurement')).toHaveAttribute('data-status', 'complete', { timeout: 60_000 });
      samples.push(JSON.parse(await page.getByTestId('measurement').innerText()));
    }
    snapshots.push({ name, checksum: model.checksumSha256, state, renderer: (await readRendererProbe(page)).at(-1), samples,
      timingScope: 'Fetch through intercepted loopback response and arrayBuffer, then shared GLTF parse including Draco worker initialization and embedded image decode. Each parsed result disposed immediately.' });
  }
  await saveBrowserEvidence(page, testInfo, { snapshots, camera: { distance: 3, fov: 45, viewport: [800, 600], dpr: 1 }, visualQa: 'REVIEW_REQUIRED' });
});
