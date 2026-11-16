import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { roomB } from './fixtures/museumContent';

const input = (page: import('@playwright/test').Page) => page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' });
const results = (page: import('@playwright/test').Page) => page.getByRole('list', { name: 'Kết quả ở các phòng khác' });

test('hiện vật ở phòng khác xuất hiện kèm tên phòng, bấm vào mở đúng trang chi tiết', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/collection?room=sculpture');
  await input(page).fill('Bình gốm');

  await expect(page.getByText('Không có hiện vật nào khớp với “Bình gốm”.')).toBeVisible();
  const link = results(page).getByRole('link');
  await expect(link).toHaveCount(1);
  await expect(link).toContainText('Bình gốm');
  await expect(link).toContainText('Gốm Việt');
  await expect(page.getByText('Tìm thấy 1 hiện vật ở phòng khác')).toBeVisible();
  // Phòng hiện tại không có kết quả → khối phòng khác nằm trước để khách thấy ngay.
  const globalTop = await page.getByRole('heading', { name: 'Ở các phòng khác' }).boundingBox();
  const roomTop = await page.getByRole('heading', { name: 'Không gian của hình khối', level: 2 }).boundingBox();
  expect(globalTop!.y).toBeLessThan(roomTop!.y);
  await link.click();
  await expect(page).toHaveURL(`/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
});

test('không lặp hiện vật của phòng đang xem; dưới 2 ký tự không gọi API; không có kết quả thì báo rõ', async ({ page }) => {
  await installMuseumApi(page);
  const searches: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/rooms/search') searches.push(url.searchParams.get('q') ?? '');
  });
  await page.goto('/collection?room=sculpture');

  await input(page).fill('H');
  await page.waitForTimeout(450);
  expect(searches).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Ở các phòng khác' })).toHaveCount(0);

  await input(page).fill('Hiện vật 1');
  await expect(page.getByText('Không có hiện vật khớp “Hiện vật 1” ở phòng khác.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('heading', { level: 3 })).toHaveText(['Hiện vật 1']);
  expect(searches).toEqual(['Hiện vật 1']); // debounce: một request cho cả chuỗi
});

test('API tìm kiếm lỗi không ảnh hưởng lọc trong phòng; Thử lại hoạt động', async ({ page }) => {
  await installMuseumApi(page);
  let fail = true;
  await page.route('**/api/rooms/search**', (route) => {
    if (fail) return fulfillMuseum(route, { success: false, data: null, message: 'Lỗi máy chủ' }, 500);
    return route.fallback();
  });
  await page.goto('/collection?room=sculpture');
  await input(page).fill('Bình gốm');
  const alert = page.getByRole('alert').filter({ hasText: 'Không tìm được ở các phòng khác' });
  await expect(alert).toBeVisible();
  await expect(page.getByText('Không có hiện vật nào khớp với “Bình gốm”.')).toBeVisible();

  fail = false;
  await alert.getByRole('button', { name: 'Thử lại' }).click();
  await expect(results(page).getByRole('link')).toContainText('Bình gốm');
});
