import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe, readRendererProbe, waitForGallerySurfaces, waitForRendererIdle } from './fixtures/museumProbe';

test('gallery uses local PBR finishes and shared instanced architecture', async ({ page }, info) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await waitForGallerySurfaces(page);
  await expect.poll(async () => (await readRendererProbe(page)).at(-1)?.textures ?? 0).toBeGreaterThanOrEqual(14);
  const finishes = await page.evaluate(() => {
    const scene = window.museumProbe.at(-1)!.scene!.deref()!;
    const materials = new Set<string>(); let instances = 0;
    scene.traverse(object => {
      if ('isInstancedMesh' in object) instances++;
      if ('material' in object) {
        const value = (object as import('three').Mesh).material;
        for (const material of Array.isArray(value) ? value : [value]) materials.add(material.name);
      }
    });
    return { materials: [...materials], instances };
  });
  expect(finishes.materials).toEqual(expect.arrayContaining(['Gallery limestone', 'Gallery walnut', 'Gallery lime plaster', 'Gallery brushed bronze']));
  expect(finishes.instances).toBeGreaterThanOrEqual(8);
  const rendering = await page.evaluate(() => {
    const record = window.museumProbe.at(-1)!;
    const renderer = record.renderer.deref()!, scene = record.scene!.deref()!;
    const shadowSizes: number[] = [];
    scene.traverse(object => {
      if ('isLight' in object && object.castShadow) shadowSizes.push((object as import('three').DirectionalLight).shadow.mapSize.x);
    });
    return { colorSpace: renderer.outputColorSpace, shadows: shadowSizes,
      environment: !!(scene as import('three').Scene).environment };
  });
  expect(rendering.colorSpace).toBe('srgb');
  expect(rendering.environment).toBe(true);
  expect(rendering.shadows.length).toBeLessThanOrEqual(1);
  expect(rendering.shadows.every(size => size <= 1024)).toBe(true);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
  await page.screenshot({ path: info.outputPath('gallery-desktop.png') });
});

test('contact shadow outside the plinth leaves walkable floor unselected', async ({ page }) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.museumProbe.at(-1)?.camera?.deref())).toBe(true);
  await page.evaluate(() => {
    const record = window.museumProbe.at(-1)!, camera = record.camera!.deref()!;
    camera.position.set(1.6, 4, 1.6); camera.lookAt(1.6, 0, 1.6); camera.updateMatrixWorld(true);
    record.renderer.deref()!.render(record.scene!.deref()! as import('three').Scene, camera);
  });
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.click(bounds.width / 2, bounds.height / 2);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('photo exports a PNG matching the fullscreen drawing buffer', async ({ page }) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible(); await waitForGallerySurfaces(page);
  const buffer = await canvas.evaluate((node: HTMLCanvasElement) => ({ width: node.width, height: node.height }));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Chụp ảnh', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^aura-museum-\d+\.png$/);
  const data = await readFile((await download.path())!);
  expect(data.subarray(1, 4).toString()).toBe('PNG');
  expect(data.readUInt32BE(16)).toBe(buffer.width);
  expect(data.readUInt32BE(20)).toBe(buffer.height);
});

test('decoded gallery finishes reach the GPU without a camera action', async ({ page }) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
    Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined });
  });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await waitForGallerySurfaces(page); await waitForRendererIdle(page);
  expect((await readRendererProbe(page)).at(-1)!.textures).toBeGreaterThanOrEqual(14);
});

test('late surface downloads repaint an idle room without camera input', async ({ page }) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseTextures!: () => void;
  const downloads = new Promise<void>(resolve => { releaseTextures = resolve; });
  await page.route('**/textures/gallery/*.png', async route => {
    await downloads;
    await route.continue();
  });
  try {
    await page.goto('/tour');
    await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    const canvas = page.getByLabel('Phòng trưng bày 3D');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await readRendererProbe(page)).at(-1)?.calls ?? 0).toBeGreaterThan(0);
    await waitForRendererIdle(page);
    const before = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
    releaseTextures();
    await waitForGallerySurfaces(page); await waitForRendererIdle(page);
    expect((await readRendererProbe(page)).at(-1)!.textures).toBeGreaterThanOrEqual(14);
    expect(await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).not.toBe(before);
  } finally { releaseTextures(); }
});
