import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, exhibit, roomA, roomB, roomC, roomSummaries, ROOM_B_ID } from './fixtures/museumContent';

test('hero supplements a sparse first room with at most two concurrent room queries and stops at three posters', async ({ page }) => {
  await installMuseumApi(page);
  const rooms = [
    ...roomSummaries,
    { id: '00000000-0000-4000-8000-000000000004', slug: 'fourth', name: 'Phòng bốn', description: null },
    { id: '00000000-0000-4000-8000-000000000005', slug: 'fifth', name: 'Phòng năm', description: null },
  ];
  const poster = (item: ReturnType<typeof exhibit>) => ({
    ...item,
    image: {
      id: '30000000-0000-4000-8000-000000000001',
      url: `https://media.example/${item.id}.webp`,
      mimeType: 'image/webp', sizeBytes: 128,
      rights: { source: null, author: null, license: null },
      altText: { vi: item.name, en: item.name },
    },
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope(rooms)));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [poster(roomA.exhibits[0])],
  })));
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, envelope({
    ...roomB, exhibits: [poster(exhibit(6, ROOM_B_ID)), poster(exhibit(7, ROOM_B_ID))],
  })));
  await page.route('**/api/rooms/empty', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fulfillMuseum(route, envelope(roomC));
  });

  await page.goto('/');
  await expect.poll(() => requests.filter((path) => path !== '/api/rooms/sculpture').length).toBeGreaterThan(0);
  await expect.poll(() => requests).toContain('/api/rooms/ceramics');
  await expect.poll(() => requests).toContain('/api/rooms/empty');
  expect(requests.filter((path) => /^\/api\/rooms\/(?!sculpture$)/.test(path))).toHaveLength(2);
  expect(requests).not.toContain('/api/rooms/fourth');
  expect(requests).not.toContain('/api/rooms/fifth');
  expect(requests.filter((path) => path === '/api/rooms/sculpture')).toHaveLength(1);
});

test('hero does not fetch other rooms when the first room already has three posters', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  const poster = (item: ReturnType<typeof exhibit>) => ({
    ...item,
    image: {
      id: '30000000-0000-4000-8000-000000000001',
      url: `https://media.example/${item.id}.webp`,
      mimeType: 'image/webp', sizeBytes: 128,
      rights: { source: null, author: null, license: null },
      altText: { vi: item.name, en: item.name },
    },
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: roomA.exhibits.slice(0, 3).map(poster),
  })));

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Hiện vật nổi bật' }).getByRole('listitem')).toHaveCount(3);
  await page.waitForLoadState('networkidle');
  await expect.poll(() => requests).toEqual(['/api/rooms/sculpture']);
});

test('changing locale reuses the public room query cache', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  const poster = (item: ReturnType<typeof exhibit>) => ({
    ...item,
    image: {
      id: '30000000-0000-4000-8000-000000000001',
      url: `https://media.example/${item.id}.webp`,
      mimeType: 'image/webp', sizeBytes: 128,
      rights: { source: null, author: null, license: null },
      altText: { vi: item.name, en: item.name },
    },
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [poster(roomA.exhibits[0])],
  })));
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, envelope({
    ...roomB, exhibits: [poster(exhibit(6, ROOM_B_ID)), poster(exhibit(7, ROOM_B_ID))],
  })));

  await page.goto('/');
  await expect.poll(() => requests.filter((path) => path === '/api/rooms/ceramics').length).toBe(1);
  await expect.poll(() => requests.filter((path) => path === '/api/rooms/empty').length).toBe(1);
  const localeSelect = page.getByRole('combobox', { name: 'Ngôn ngữ' });
  await localeSelect.selectOption('en');
  await expect(localeSelect).toHaveValue('en');
  await page.waitForLoadState('networkidle');
  expect(requests.filter((path) => path !== '/api/rooms/sculpture')).toHaveLength(2);
});

test('hero stops after four supplemental rooms even when responses fail or have too few posters', async ({ page }) => {
  await installMuseumApi(page);
  const addedRooms = [
    { id: '00000000-0000-4000-8000-000000000004', slug: 'fourth', name: 'Phòng bốn', description: null },
    { id: '00000000-0000-4000-8000-000000000005', slug: 'fifth', name: 'Phòng năm', description: null },
    { id: '00000000-0000-4000-8000-000000000006', slug: 'sixth', name: 'Phòng sáu', description: null },
  ];
  const requests: string[] = [];
  let inFlight = 0;
  let maxConcurrent = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([...roomSummaries, ...addedRooms])));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{
      ...exhibit(1), image: {
        id: '30000000-0000-4000-8000-000000000001', url: 'https://media.example/primary.webp',
        mimeType: 'image/webp', sizeBytes: 128, rights: { source: null, author: null, license: null }, altText: { vi: 'Ảnh', en: 'Image' },
      },
    }],
  })));
  const delayed = async (route: Parameters<typeof fulfillMuseum>[0], data: unknown) => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fulfillMuseum(route, envelope(data));
    inFlight -= 1;
  };
  await page.route('**/api/rooms/ceramics', (route) => delayed(route, { ...roomB, exhibits: [] }));
  await page.route('**/api/rooms/empty', async (route) => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) });
    inFlight -= 1;
  });
  await page.route('**/api/rooms/fourth', (route) => delayed(route, {
    ...roomB, id: addedRooms[0].id, slug: 'fourth',
    exhibits: [{
      ...exhibit(8, addedRooms[0].id), image: {
        id: '30000000-0000-4000-8000-000000000008', url: 'https://media.example/fourth.webp',
        mimeType: 'image/webp', sizeBytes: 128, rights: { source: null, author: null, license: null }, altText: { vi: 'Ảnh', en: 'Image' },
      },
    }],
  }));
  await page.route('**/api/rooms/fifth', (route) => delayed(route, { ...roomC, id: addedRooms[1].id, slug: 'fifth' }));

  await page.goto('/');
  await expect.poll(() => requests.filter((path) => path !== '/api/rooms/sculpture').length).toBe(4);
  expect(requests).toContain('/api/rooms/fourth');
  expect(requests).toContain('/api/rooms/fifth');
  expect(requests).not.toContain('/api/rooms/sixth');
  expect(maxConcurrent).toBe(2);
});
