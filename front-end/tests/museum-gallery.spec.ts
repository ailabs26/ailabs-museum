import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';

test('gallery uses local PBR finishes and shared instanced architecture', async ({ page }, info) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await expect.poll(async () => (await readRendererProbe(page)).at(-1)?.textures ?? 0).toBeGreaterThanOrEqual(13);
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
