import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';

test('grid columns follow available container width', async ({ page }) => {
  await installMuseumApi(page);
  const grid = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
  await page.goto('/collection?room=sculpture');
  const cards = grid.getByRole('listitem');
  await expect(cards).toHaveCount(5);
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const containerWidth = await grid.evaluate((element) => element.parentElement!.getBoundingClientRect().width);
    const positions = await cards.evaluateAll((items) => items.slice(0, 3).map((item) => item.getBoundingClientRect().x));
    expect(new Set(positions).size, `${containerWidth}px container at ${width}px viewport`)
      .toBe(containerWidth >= 800 ? 3 : containerWidth >= 524 ? 2 : 1);
  }

  for (const [width, columns] of [[523, 1], [524, 2], [600, 2], [799, 2], [800, 3]] as const) {
    await grid.evaluate((element, size) => { element.parentElement!.style.width = `${size}px`; }, width);
    const positions = await cards.evaluateAll((items) => items.slice(0, 3).map((item) => item.getBoundingClientRect().x));
    expect(new Set(positions).size, `${width}px fixed container`).toBe(columns);
  }
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
