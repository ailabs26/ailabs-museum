import type { Page, Route } from '@playwright/test';
import { envelope, roomA, roomB, roomC, roomSummaries } from './museumContent';

export async function fulfillMuseum(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(data),
    headers: { 'Access-Control-Allow-Origin': route.request().headers().origin ?? 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true' },
  });
}

export async function installMuseumApi(page: Page) {
  const requests: string[] = [];
  await page.route('**/api/auth/me', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401));
  await page.route('**/api/auth/refresh', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401));
  await page.route('**/api/rooms**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const slug = decodeURIComponent(path.slice('/api/rooms/'.length));
    const details = { sculpture: roomA, ceramics: roomB, empty: roomC };
    const data = path === '/api/rooms' ? roomSummaries : details[slug as keyof typeof details];
    await fulfillMuseum(route, data ? envelope(data) : { success: false, data: null, message: 'Không tìm thấy phòng trưng bày' }, data ? 200 : 404);
  });
  return requests;
}
