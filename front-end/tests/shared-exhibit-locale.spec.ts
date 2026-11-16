import { expect, test } from '@playwright/test';
import { installMedia } from './fixtures/publicMediaApi';

test('card text and image alt use the selected locale', async ({ page }) => {
  await installMedia(page);
  await page.goto('/collection');
  await page.getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  const card = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem').first();
  await expect(card.getByRole('heading', { name: 'Ceramic vase' })).toBeVisible();
  await expect(card.getByRole('img', { name: 'Vase photo' })).toBeAttached();
});
