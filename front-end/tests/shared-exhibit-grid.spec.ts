import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';

test('grid columns follow available container width', async ({ page }) => {
  await installMuseumApi(page);
  const grid = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
  for (const [width, columns] of [[320, 1], [390, 1], [768, 2], [1024, 3], [1440, 3]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/collection?room=sculpture');
    const cards = grid.getByRole('listitem');
    await expect(cards).toHaveCount(5);
    const positions = await cards.evaluateAll((items) => items.slice(0, 3).map((item) => item.getBoundingClientRect().x));
    expect(new Set(positions).size).toBe(columns);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/collection?room=sculpture');
  await grid.evaluate((element) => { element.parentElement!.style.width = '600px'; });
  const positions = await grid.getByRole('listitem').evaluateAll((items) => items.slice(0, 3).map((item) => item.getBoundingClientRect().x));
  expect(new Set(positions).size).toBe(2);
});

test('card actions stay readable when the container crosses the two-column breakpoint', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 568, height: 900 });
  await page.goto('/collection?room=sculpture');
  const card = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem').first();
  const detail = card.getByRole('link', { name: /Xem chi tiết/ });
  const detailHeight = await detail.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(detailHeight.height).toBeLessThanOrEqual(detailHeight.lineHeight + 22);

  const report = card.getByRole('button', { name: 'Báo nội dung' });
  const labelWidth = await report.getByText('Báo nội dung').evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(labelWidth.scroll).toBeLessThanOrEqual(labelWidth.client);
});
