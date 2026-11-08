import { expect, test, type Page } from '@playwright/test';
import { PUBLIC_UI_STRINGS } from '../../back-end/src/database/seeds/public-ui-strings';
import { initialTestExhibits, type TestExhibit } from './fixtures/cmsExhibitsApi';
import { installCmsSession } from './fixtures/cmsSession';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

const EXHIBIT = roomA.exhibits[0];
const ko = (key: string) => PUBLIC_UI_STRINGS.find((item) => item.namespace === key)!.values.ko;

async function installPublic(page: Page, status = 200) {
  await installMuseumApi(page);
  await page.route('**/api/public/translations**', (route) => {
    const locale = new URL(route.request().url()).searchParams.get('locale') as 'ko';
    return fulfillMuseum(route, envelope(Object.fromEntries(PUBLIC_UI_STRINGS.map((item) => [item.namespace, item.values[locale]]))));
  });
  const calls: string[] = [];
  await page.route('**/api/public/exhibits/*/location', (route) => {
    calls.push(route.request().url());
    return status === 200
      ? fulfillMuseum(route, envelope({ exhibitId: EXHIBIT.id, roomSlug: roomA.slug }))
      : fulfillMuseum(route, { success: false, data: null, message: 'Không tìm thấy hiện vật' }, status);
  });
  return calls;
}

const keepVietnamese = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', '{"version":1,"value":"vi"}'));

test.describe('Khách quét mã QR', () => {
  test('/e/<id> chuyển tới trang chi tiết ở phòng hiện tại, không để lại /e trong lịch sử', async ({ page }) => {
    await installPublic(page);
    await keepVietnamese(page);
    await page.goto(`/e/${EXHIBIT.id}`);
    await expect(page).toHaveURL(`/collection/${roomA.slug}/exhibits/${EXHIBIT.id}`);
    await expect(page.getByRole('heading', { level: 1, name: EXHIBIT.name })).toBeVisible();
  });

  test('hiện vật không công khai hoặc id sai: báo không tìm thấy, có liên kết về bộ sưu tập', async ({ page }) => {
    const calls = await installPublic(page, 404);
    await keepVietnamese(page);
    await page.goto(`/e/${EXHIBIT.id}`);
    await expect(page.getByRole('alert')).toContainText('Không tìm thấy hiện vật');
    await expect(page.getByRole('link', { name: 'Về bộ sưu tập' })).toBeVisible();

    await page.goto('/e/khong-phai-uuid');
    await expect(page.getByRole('alert')).toContainText('Không tìm thấy hiện vật');
    expect(calls).toHaveLength(1);
  });

  test.describe('máy khách tiếng Hàn', () => {
    test.use({ locale: 'ko-KR' });

    test('chưa từng chọn ngôn ngữ: trang hiện tiếng Hàn', async ({ page }) => {
      await installPublic(page);
      await page.goto(`/e/${EXHIBIT.id}`);
      await expect(page).toHaveURL(`/collection/${roomA.slug}/exhibits/${EXHIBIT.id}`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
      await expect(page.getByRole('heading', { level: 2, name: ko('ui.exhibit.story') })).toBeVisible();
    });

    test('đã chọn tiếng Việt từ trước: giữ nguyên', async ({ page }) => {
      await installPublic(page);
      await keepVietnamese(page);
      await page.goto(`/e/${EXHIBIT.id}`);
      await expect(page).toHaveURL(`/collection/${roomA.slug}/exhibits/${EXHIBIT.id}`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    });

    test('vào trang thường (không qua mã QR) vẫn mặc định tiếng Việt', async ({ page }) => {
      await installPublic(page);
      await page.goto('/collection');
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    });
  });
});

const ROOM_ID = initialTestExhibits[0].roomId;
const draft: TestExhibit = {
  ...structuredClone(initialTestExhibits[0]),
  id: 'exhibit-002',
  status: 'draft',
  content: { ...initialTestExhibits[0].content, name: { vi: 'Bản nháp chưa công khai', en: 'Draft' } },
};
const published: TestExhibit = { ...structuredClone(initialTestExhibits[0]), status: 'published' };

async function installCms(page: Page) {
  await installCmsSession(page, ['room:read', 'exhibit:read']);
  await page.route('**/api/admin/exhibits**', (route) => fulfillMuseum(route,
    { ...envelope([published, draft]), meta: { page: 1, pageSize: 100, total: 2 } }));
  await page.route(`**/api/admin/rooms/${ROOM_ID}`, (route) => fulfillMuseum(route,
    envelope({ id: ROOM_ID, slug: 'phong-lich-su', name: 'Phòng Lịch Sử Kháng Chiến', description: null, status: 'active', exhibitsCount: 2 })));
  await page.route('**/api/admin/rooms?**', (route) => fulfillMuseum(route,
    { ...envelope([{ id: ROOM_ID, slug: 'phong-lich-su', name: 'Phòng Lịch Sử Kháng Chiến', description: null, status: 'active', exhibitsCount: 2 }]), meta: { page: 1, pageSize: 15, total: 1 } }));
}

test.describe('CMS: mã QR', () => {
  test('hộp thoại QR: ảnh mã, liên kết cố định và cảnh báo khi chưa công khai', async ({ page }) => {
    await installCms(page);
    await page.goto('/admin/exhibits');
    const table = page.getByRole('table');

    await table.getByRole('button', { name: 'Mã QR hiện vật Súng Trường K54' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mã QR — Súng Trường K54' });
    await expect(dialog.getByRole('img', { name: 'Mã QR mở trang hiện vật Súng Trường K54' })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Liên kết' })).toHaveValue(new RegExp(`/e/${published.id}$`));
    await expect(dialog.getByText(/chưa xuất bản hoặc đang ẩn/)).toHaveCount(0);
    await page.keyboard.press('Escape');

    await table.getByRole('button', { name: 'Mã QR hiện vật Bản nháp chưa công khai' }).click();
    await expect(page.getByRole('dialog').getByText(/chưa xuất bản hoặc đang ẩn/)).toBeVisible();
  });

  test('trang in theo phòng: mặc định chỉ hiện vật đã xuất bản, bật công tắc thì hiện cả bản nháp', async ({ page }) => {
    await installCms(page);
    await page.goto('/admin/rooms');
    await page.getByRole('button', { name: 'In mã QR phòng Phòng Lịch Sử Kháng Chiến' }).or(
      page.getByRole('link', { name: 'In mã QR phòng Phòng Lịch Sử Kháng Chiến' })).first().click();
    await expect(page).toHaveURL(`/admin/rooms/${ROOM_ID}/qr`);

    const grid = page.getByRole('list', { name: 'Mã QR các hiện vật' });
    await expect(grid.getByRole('img', { name: 'Mã QR Súng Trường K54' })).toBeVisible();
    await expect(grid.getByText('Bản nháp chưa công khai')).toHaveCount(0);

    await page.getByText('Chỉ hiện vật đã xuất bản').click();
    await expect(page.getByRole('switch', { name: 'Chỉ hiện vật đã xuất bản' })).not.toBeChecked();
    await expect(grid.getByRole('img', { name: 'Mã QR Bản nháp chưa công khai' })).toBeVisible();
    await expect(page.getByText('1 hiện vật chưa công khai: khách quét mã sẽ chưa mở được.')).toBeVisible();
  });
});
