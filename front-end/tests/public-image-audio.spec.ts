import { expect, test } from '@playwright/test';
import { installMedia } from './fixtures/publicMediaApi';

for (const view of ['/', '/collection', 'detail', '/tour']) {
  test(`API image decodes in ${view}`, async ({ page }) => {
    const room = await installMedia(page);
    await page.goto(view === 'detail' ? `/collection/${room.slug}/exhibits/${room.exhibits[0].id}` : view);
    const image = page.getByRole('img', { name: 'Ảnh bình', exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    if (view !== '/tour') await expect(page.locator('canvas')).toHaveCount(0);
    if (view === '/tour') {
      await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
      await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' }).getByRole('img', { name: 'Ảnh bình' })).toBeVisible();
    }
  });
}

test('broken API image falls back without hiding exhibit text', async ({ page }) => {
  const room = await installMedia(page, 'error');
  await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
  await expect(page.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
});

test('a new image URL recovers after the previous image failed', async ({ page }) => {
  const room = await installMedia(page, 'error');
  await page.goto('/collection');
  await expect(page.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
  room.exhibits[0].image!.url = 'http://localhost:3001/media/uploads/images/new.png';
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect.poll(() => page.getByRole('img', { name: 'Ảnh bình', exact: true }).evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test('corrupt image bytes use the labelled fallback', async ({ page }) => {
  const room = await installMedia(page, 'corrupt');
  await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
  await expect(page.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
});
