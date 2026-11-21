import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB } from './fixtures/museumContent';
import { installMedia } from './fixtures/publicMediaApi';
import { publicRoomWithMediaResponse } from './fixtures/publicRoomWithMedia';

const path = (id: string, slug = roomA.slug) => `/collection/${slug}/exhibits/${id}`;
const first = roomA.exhibits[0];

test.beforeEach(async ({ page }) => {
  await installMuseumApi(page);
});

test('breadcrumb links to the actual room and summary preserves the full story', async ({ page }) => {
  const description = 'Tên và mô tả lấy từ nội dung đã xuất bản.\n\n' + 'Văn bản đầy đủ của câu chuyện. '.repeat(22).trim();
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...first, description }],
  })));
  await page.goto(path(first.id));
  const breadcrumb = page.getByRole('navigation', { name: 'Đường dẫn hiện vật' });
  await expect(breadcrumb.getByRole('link', { name: 'Bộ sưu tập', exact: true })).toHaveAttribute('href', '/collection');
  await expect(breadcrumb.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' })).toHaveAttribute('href', '/collection?room=sculpture');
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(first.name);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('article header')).toContainText('Tên và mô tả lấy từ nội dung đã xuất bản.');
  await expect(page.getByRole('region', { name: 'Câu chuyện hiện vật' }).locator('p')).toHaveJSProperty('textContent', description);
});

test('same-room exhibits are sorted, capped and navigate with a fresh owner', async ({ page }) => {
  const [, second, third, fourth, fifth] = roomA.exhibits;
  const room = { ...roomA, exhibits: [{ ...fifth, displayOrder: 2 }, fourth, first,
    { ...third, displayOrder: 1 }, { ...second, displayOrder: 1 }] };
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope(room)));
  await page.goto(path(first.id));
  const related = page.getByRole('region', { name: 'Hiện vật khác trong cùng phòng' });
  const links = related.getByRole('link', { name: /^Xem chi tiết / });
  await expect(links).toHaveCount(3);
  for (const [index, exhibit] of [second, third, fifth].entries()) {
    await expect(links.nth(index)).toHaveAttribute('href', path(exhibit.id));
  }
  await page.getByRole('textbox', { name: 'Ghi chú của bạn' }).fill('Chỉ lưu cho hiện vật đầu.');
  await links.first().click();
  await expect(page).toHaveURL(path(second.id));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(second.name);
  await expect(page.getByRole('textbox', { name: 'Ghi chú của bạn' })).toHaveValue('');
  await expect(related.getByRole('link', { name: `Xem chi tiết ${second.name}`, exact: true })).toHaveCount(0);
  await page.goto(path(roomB.exhibits[0].id, roomB.slug));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomB.exhibits[0].name);
  await expect(related).toHaveCount(0);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [first, second] })));
  await page.goto(path(first.id));
  await expect(related.getByRole('link', { name: /^Xem chi tiết / })).toHaveCount(1);
});

test('a published model does not activate a viewer or replace the poster', async ({ page }) => {
  const room = await installMedia(page);
  const item = room.exhibits[0];
  item.model = publicRoomWithMediaResponse.data.exhibits[0].model;
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (/webgl/i.test(type)) document.documentElement.dataset.webglRequested = 'true';
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  const unexpected: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/(?:\/model$|\.glb$|\/MuseumScene[.-]|GLTFLoader|DRACOLoader|\/three(?:[.-]|\/)|react-three)/.test(url.pathname)
      || url.pathname.endsWith('/guide.wav')) unexpected.push(url.pathname);
  });
  await page.goto(path(item.id, room.slug));
  const hero = page.locator('article header');
  const poster = hero.getByRole('img', { name: 'Ảnh bình' });
  await expect(poster).toHaveCSS('object-fit', 'contain');
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(hero.getByRole('link', { name: 'Xem trong không gian 3D' })).toHaveAttribute('href', `/tour?room=${room.slug}&exhibit=${item.id}`);
  await expect(page.getByRole('region', { name: 'Nguồn & bản quyền' })).toContainText('CC BY 4.0');
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-webgl-requested', 'true');
  expect(unexpected).toEqual([]);

  await page.route('**/media/uploads/images/**', (route) => route.fulfill({ status: 404 }));
  const height = await poster.evaluate((image) => getComputedStyle(image).height);
  await page.reload();
  const fallback = hero.getByText('Chưa có ảnh', { exact: true });
  await expect(fallback).toBeVisible();
  await expect(hero.locator('[data-shape]').locator('..')).toHaveCSS('height', height);
  await expect(page.getByRole('region', { name: 'Bản thuyết minh' })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test('a new exhibit can retry a shared poster URL after a prior failure', async ({ page }) => {
  const second = roomA.exhibits[1];
  const image = {
    ...publicRoomWithMediaResponse.data.exhibits[0].image,
    url: 'https://media.example/shared.svg',
  };
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...first, image }, { ...second, image }],
  })));
  let isUnavailable = true;
  await page.route(image.url, (route) => isUnavailable
    ? route.fulfill({ status: 404 })
    : route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>',
    }));
  await page.goto(path(first.id));
  const hero = page.locator('article header');
  await expect(hero.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
  isUnavailable = false;
  await page.getByRole('link', { name: `Xem chi tiết ${second.name}`, exact: true }).click();
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText(second.name);
  const poster = hero.getByRole('img', { name: image.altText.vi });
  await expect(poster).toBeVisible();
  await expect.poll(() => poster.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
});
