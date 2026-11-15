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

test('cards use the heritage surface and typography in light and dark themes', async ({ page }) => {
  await installMuseumApi(page);
  const grid = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
  for (const [colorScheme, surface, border] of [
    ['light', 'rgb(255, 249, 240)', 'rgb(217, 205, 187)'],
    ['dark', 'rgb(27, 40, 36)', 'rgb(58, 74, 67)'],
  ] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/collection?room=sculpture');
    await expect(grid.getByRole('listitem')).toHaveCount(5);
    const card = grid.getByRole('listitem').first();
    const styles = await card.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      border: getComputedStyle(element).borderTopColor,
      titleFont: getComputedStyle(element.querySelector('h3')!).fontFamily,
    }));
    expect(styles.background).toBe(surface);
    expect(styles.border).toBe(border);
    expect(styles.titleFont).toContain('Noto Serif');

    const detail = card.getByRole('link', { name: `Xem chi tiết ${roomA.exhibits[0].name}`, exact: true });
    await detail.focus();
    const focus = await detail.evaluate((element) => ({
      width: getComputedStyle(element).outlineWidth,
      style: getComputedStyle(element).outlineStyle,
    }));
    expect(focus).toEqual({ width: '3px', style: 'solid' });
  }
});
