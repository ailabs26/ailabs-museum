import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { installRendererProbe, readRendererProbe } from './fixtures/museumProbe';

test('static gallery stays within the reduced draw and resource budgets', async ({ page }) => {
  await installMuseumApi(page);
  await installRendererProbe(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await readRendererProbe(page)).at(-1)?.calls ?? 0).toBeGreaterThan(0);
  const scene = (await readRendererProbe(page)).at(-1)!;
  expect(scene.calls).toBeLessThanOrEqual(55);
  expect(scene.geometries).toBeLessThanOrEqual(55);
  expect(scene.materials).toBeLessThanOrEqual(60);
});

test('repeated room switches release previous contexts and keep current-room resources bounded', async ({ page }) => {
  test.setTimeout(60_000);
  const requests = await installMuseumApi(page);
  await installRendererProbe(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const budgets = new Map<string, { geometries: number; textures: number; materials: number; objects: number }>();
  for (const slug of ['sculpture', 'ceramics', 'sculpture', 'ceramics', 'sculpture', 'ceramics', 'sculpture']) {
    await page.getByLabel('Chọn phòng trưng bày').selectOption(slug);
    await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(async () => (await readRendererProbe(page)).filter((item) => item.live).length).toBe(1);
    await expect.poll(async () => (await readRendererProbe(page)).at(-1)!.calls).toBeGreaterThan(0);
    const { geometries, textures, materials, objects } = (await readRendererProbe(page)).at(-1)!;
    const current = { geometries, textures, materials, objects };
    if (budgets.has(slug)) expect(current).toEqual(budgets.get(slug));
    else budgets.set(slug, current);
    await expect(page.getByRole('list', { name: 'Các hiện vật' }).getByRole('listitem')).toHaveCount(slug === 'sculpture' ? 5 : 1);
  }
  expect(requests.filter((path) => path === '/api/rooms/sculpture')).toHaveLength(1);
  expect(requests.filter((path) => path === '/api/rooms/ceramics')).toHaveLength(1);
  expect(requests).not.toContain('/api/rooms/empty');
  await page.getByRole('button', { name: 'Dừng 3D' }).click();
  await expect.poll(async () => (await readRendererProbe(page)).filter((item) => item.live).length).toBe(0);
});
