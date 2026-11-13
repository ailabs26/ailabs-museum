import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe, readRendererProbe, waitForGallerySurfaces, waitForRendererIdle } from './fixtures/museumProbe';

test('static gallery stays within the reduced draw and resource budgets', async ({ page }) => {
  await installMuseumApi(page);
  await installRendererProbe(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  await waitForGallerySurfaces(page);
  await waitForRendererIdle(page);
  await expect.poll(async () => (await readRendererProbe(page)).at(-1)?.calls ?? 0).toBeGreaterThan(0);
  const scene = (await readRendererProbe(page)).at(-1)!;
  // Authored finishes, architectural ceiling and one shadow pass replace the
  // flat Day-4 shell. Geometry is bounded; shared surfaces reduce materials.
  expect(scene.calls).toBeLessThanOrEqual(70);
  expect(scene.geometries).toBeLessThanOrEqual(70);
  expect(scene.materials).toBeLessThanOrEqual(45);
  expect(scene.textures).toBeLessThanOrEqual(18);
  expect(scene.triangles).toBeLessThanOrEqual(25_000);
});

test('repeated room switches release previous contexts and keep current-room resources bounded', async ({ page }) => {
  test.setTimeout(90_000);
  const requests = await installMuseumApi(page);
  await installRendererProbe(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const budgets = new Map<string, { geometries: number; textures: number; materials: number; objects: number }>();
  for (const slug of ['sculpture', 'ceramics', 'sculpture', 'ceramics', 'sculpture', 'ceramics', 'sculpture']) {
    await page.getByLabel('Chọn phòng trưng bày').selectOption(slug);
    await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
    await waitForGallerySurfaces(page);
    await waitForRendererIdle(page);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(async () => (await readRendererProbe(page)).filter((item) => item.live).length).toBe(1);
    await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.calls).toBeGreaterThan(0);
    const { geometries, textures, materials, objects } = (await readRendererProbe(page)).at(-1)!;
    const current = { geometries, textures, materials, objects };
    if (budgets.has(slug)) expect(current).toEqual(budgets.get(slug));
    else budgets.set(slug, current);
    await expect(page.locator('#museum-catalogue li')).toHaveCount(slug === 'sculpture' ? 5 : 1);
  }
  expect(requests.filter((path) => path === '/api/rooms/sculpture')).toHaveLength(1);
  expect(requests.filter((path) => path === '/api/rooms/ceramics')).toHaveLength(1);
  expect(requests).not.toContain('/api/rooms/empty');
  await page.getByRole('button', { name: 'Thoát tham quan' }).click();
  await expect.poll(async () => (await readRendererProbe(page)).filter((item) => item.live).length).toBe(0);
});
