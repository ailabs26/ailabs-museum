import { expect, test } from '@playwright/test';
import { installMedia } from './fixtures/publicMediaApi';

test('card media frame is fixed 4:3 and contains the published image', async ({ page }) => {
  await installMedia(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collection');
  const image = page.getByRole('img', { name: 'Ảnh bình', exact: true });
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  const media = await image.evaluate((element) => {
    const frame = element.parentElement!.getBoundingClientRect();
    return { ratio: frame.width / frame.height, fit: getComputedStyle(element).objectFit };
  });
  expect(media.ratio).toBeCloseTo(4 / 3, 2);
  expect(media.fit).toBe('contain');
});

test('missing or failed card media keeps the labelled placeholder and exhibit title', async ({ page }) => {
  await installMedia(page, 'error');
  await page.goto('/collection');
  const card = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText('Hình minh họa thay thế')).toBeVisible();
  await expect(card.getByText('Chưa có ảnh')).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
});
