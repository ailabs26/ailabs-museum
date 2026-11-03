import { expect, test, type Page } from '@playwright/test';
import { deferred, installExhibitEditApi } from './fixtures/exhibitEditApi';

/**
 * VT-079 TC15 — autosave trong drawer sửa hiện vật (AC1, AC5). API giả có trạng thái và
 * kiểm tra expectedVersion như contract back-end; clock của trình duyệt được điều khiển để
 * debounce không phụ thuộc thời gian thật.
 */
const dialog = (page: Page) => page.getByRole('dialog');
const nameField = (page: Page) => dialog(page).getByRole('textbox', { name: 'Tên hiện vật (Tiếng Việt)', exact: true });

async function openEdit(page: Page, name = 'Hiện vật 1') {
  await page.getByRole('row').filter({ hasText: name }).getByRole('button').nth(1).click();
  await expect(nameField(page)).toHaveValue(name);
}

test('autosave gửi expectedVersion, giữ drawer mở và dùng version mới cho lần sau', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  await page.clock.install();
  await page.goto('/admin/exhibits');
  await openEdit(page);

  await nameField(page).fill('Bản tự lưu 1');
  await page.clock.runFor(1600);
  await expect(dialog(page).getByText(/Đã lưu nháp lúc/)).toBeVisible();
  await nameField(page).fill('Bản tự lưu 2');
  await page.clock.runFor(1600);
  await expect.poll(() => state.patches.length).toBe(2);

  expect(state.patches.map(p => [p.body.name?.vi, p.body.expectedVersion])).toEqual([['Bản tự lưu 1', 1], ['Bản tự lưu 2', 2]]);
  expect(state.conflicts).toBe(0);
  await expect(dialog(page)).toBeVisible();
  expect(state.records[0].content.name).toEqual({ vi: 'Bản tự lưu 2' });
});

test('bản lưu từ tab khác mới hơn: autosave dừng, giữ nội dung đang gõ, không ghi đè', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  await page.clock.install();
  await page.goto('/admin/exhibits');
  await openEdit(page);

  // Một tab khác lưu trước: server đã ở version 2 với nội dung khác.
  state.records[0].content.name = { vi: 'Bản từ tab khác' };
  state.records[0].version = 2;

  await nameField(page).fill('Bản đang gõ');
  await page.clock.runFor(1600);
  await expect(dialog(page).getByRole('alert')).toContainText('bản mới hơn');
  await expect(nameField(page)).toHaveValue('Bản đang gõ');

  await nameField(page).fill('Bản đang gõ tiếp');
  await page.clock.runFor(30_000);
  expect(state.patches).toHaveLength(1);
  expect(state.conflicts).toBe(1);
  expect(state.records[0].content.name).toEqual({ vi: 'Bản từ tab khác' });
  expect(state.records[0].version).toBe(2);
});

test('bấm Lưu ngay sau khi gõ, mạng chậm: autosave không đua với lưu tay (AI review #1)', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  await page.clock.install();
  await page.goto('/admin/exhibits');
  await openEdit(page);
  const network = deferred();
  state.patchHook = () => network.promise;

  await nameField(page).fill('Gõ rồi bấm Lưu ngay');
  await dialog(page).getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect.poll(() => state.patches.length).toBe(1);
  await page.clock.runFor(5000); // debounce autosave đã quá hạn trong lúc lưu tay còn chờ mạng
  network.release();
  await page.clock.runFor(2000);

  await expect.poll(() => state.records[0].version).toBe(2);
  expect(state.patches).toHaveLength(1);
  expect(state.conflicts).toBe(0);
  expect(state.records[0].content.name).toEqual({ vi: 'Gõ rồi bấm Lưu ngay' });
});
