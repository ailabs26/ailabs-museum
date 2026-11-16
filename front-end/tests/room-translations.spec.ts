import { expect, test } from '@playwright/test';
import { installCmsRoomsApi } from './fixtures/cmsRoomsApi';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomSummaries } from './fixtures/museumContent';

test('CMS: dịch tên phòng trong form, ô trống không gửi lên', async ({ page }) => {
  const { writes } = await installCmsRoomsApi(page);
  await page.goto('/admin/rooms');
  await page.getByRole('row').filter({ hasText: 'Phòng Lịch Sử Kháng Chiến' }).getByRole('button', { name: 'Sửa' }).click();

  const drawer = page.getByRole('dialog', { name: 'Cập nhật phòng trưng bày' });
  await drawer.getByText('한국어').click();
  await drawer.getByRole('textbox', { name: 'Tên (한국어)' }).fill(' 역사관 ');
  await drawer.getByRole('button', { name: /Lưu|Cập nhật/ }).click();

  await expect.poll(() => writes.find((write) => write.method === 'PATCH')?.data).toMatchObject({
    translations: { name: { ko: '역사관' }, description: {} },
  });
});

test('Khách: tên phòng đổi theo ngôn ngữ, không tải lại; chưa dịch thì giữ tiếng Việt', async ({ page }) => {
  const i18n = {
    vi: { name: roomA.name, description: roomA.description }, en: { name: null, description: null },
    ko: { name: '조각 공간', description: null },
  };
  await installMuseumApi(page);
  let roomLoads = 0;
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope(roomSummaries.map((room) => (room.id === roomA.id ? { ...room, i18n } : room)))));
  await page.route('**/api/rooms/sculpture', (route) => { roomLoads++; return fulfillMuseum(route, envelope({ ...roomA, i18n })); });

  await page.goto('/collection?room=sculpture');
  const title = page.getByRole('heading', { level: 2, name: roomA.name });
  await expect(title).toBeVisible();
  const loads = roomLoads;

  await page.getByRole('combobox', { name: 'Ngôn ngữ' }).first().selectOption('ko');
  await expect(page.getByRole('heading', { level: 2, name: '조각 공간' })).toBeVisible();
  await expect(page.getByText(roomA.description, { exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Ngôn ngữ' }).first().selectOption('ja');
  await expect(title).toBeVisible();
  expect(roomLoads).toBe(loads);
});
