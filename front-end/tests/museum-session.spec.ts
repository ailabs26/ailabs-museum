import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';

test('failed initial session recovery does not restart public room requests', async ({ page }) => {
  const requests = await installMuseumApi(page);
  let finishRefresh!: () => void;
  const refresh = new Promise<void>((resolve) => { finishRefresh = resolve; });
  let refreshFinished = false;
  await page.route('**/api/auth/refresh', async (route) => {
    await refresh;
    await fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401);
    refreshFinished = true;
  });
  await page.goto('/tour');
  await expect(page.getByRole('listitem')).toHaveCount(5);
  expect(requests).toEqual(['/api/rooms', '/api/rooms/sculpture']);
  finishRefresh();
  await expect.poll(() => refreshFinished).toBe(true);
  // Observe after the failed session has propagated through the provider.
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('listitem')).toHaveCount(5);
  expect(requests).toEqual(['/api/rooms', '/api/rooms/sculpture']);
});
