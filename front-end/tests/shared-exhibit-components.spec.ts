import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';

test('shared grid keeps ordered list semantics, detail routes and independent actions', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/collection?room=sculpture');

  const grid = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
  const cards = grid.getByRole('listitem');
  const ordered = [...roomA.exhibits].sort((left, right) =>
    left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));

  await expect(cards).toHaveCount(ordered.length);
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText(ordered.map((exhibit) => exhibit.name));
  for (const [index, exhibit] of ordered.entries()) {
    await expect(cards.nth(index).getByRole('link', { name: `Xem chi tiết ${exhibit.name}`, exact: true }))
      .toHaveAttribute('href', `/collection/${encodeURIComponent(roomA.slug)}/exhibits/${encodeURIComponent(exhibit.id)}`);
  }
  expect(await cards.evaluateAll((items) => items.some((item) => item.querySelector('a button, button a')))).toBe(false);
  await expect(grid.locator('canvas')).toHaveCount(0);
});
