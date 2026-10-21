import { expect, test, type Page } from '@playwright/test';
import { deferred, installExhibitEditApi } from './fixtures/exhibitEditApi';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

const nameField = (page: Page) => page.getByRole('dialog').getByRole('textbox', { name: 'Tên hiện vật (Tiếng Việt)', exact: true });
async function edit(page: Page, name = 'Hiện vật 1') {
  await page.getByRole('row').filter({ hasText: name }).getByRole('button').nth(1).click();
}

test('loads the complete fresh detail before enabling editing, not the stale list row', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  state.listRows = structuredClone(state.records);
  const record = state.records[0];
  record.content.name = { vi: 'Tên mới' };
  record.content.description = { vi: 'Mô tả mới' };
  record.content.transcript = { vi: 'Thuyết minh mới' };
  record.content.altText = { vi: 'Ảnh mới' };
  record.content.imageId = '90000000-0000-4000-8000-000000000001';
  record.content.audioViId = '90000000-0000-4000-8000-000000000011';
  const gate = deferred();
  state.detailHook = async (route, detail) => { await gate.promise; await fulfillMuseum(route, envelope(detail)); };
  await page.goto('/admin/exhibits');
  await edit(page);
  await expect(page.getByRole('status')).toContainText('Đang tải hiện vật');
  await expect(nameField(page)).toHaveCount(0);
  gate.release();
  await expect(nameField(page)).toHaveValue('Tên mới');
  await expect(page.getByRole('textbox', { name: 'Tên hiện vật (Tiếng Anh)', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Mô tả hiện vật (Tiếng Việt)', exact: true })).toHaveValue('Mô tả mới');
  await page.getByRole('tab', { name: 'Media & thuyết minh' }).click();
  await expect(page.getByRole('textbox', { name: 'Hình ảnh hiện vật', exact: true })).toHaveValue(/image-1/);
  await expect(page.getByRole('textbox', { name: 'Audio thuyết minh (MP3)', exact: true })).toHaveValue(/audio-1/);
  await expect(page.getByRole('textbox', { name: 'Lời thuyết minh (transcript)', exact: true })).toHaveValue('Thuyết minh mới');
  await expect(page.getByRole('textbox', { name: 'Alt text ảnh (Tiếng Việt)', exact: true })).toHaveValue('Ảnh mới');
});

test('detail errors block saving until retry succeeds', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  state.detailHook = async route => { await fulfillMuseum(route, { success: false, data: null, message: 'Detail unavailable' }, 404); };
  await page.goto('/admin/exhibits'); await edit(page);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Không tải được hiện vật');
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toHaveCount(0);
  state.detailHook = undefined;
  await page.getByRole('dialog').getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(nameField(page)).toHaveValue('Hiện vật 1');
  expect(state.patches).toEqual([]);
});

test('reopening the same ID always fetches again and ignores a previous pending session', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  const gate = deferred();
  state.detailHook = async (route, detail, count) => {
    if (count === 1) await gate.promise;
    await fulfillMuseum(route, envelope(detail));
  };
  await page.goto('/admin/exhibits'); await edit(page);
  await expect.poll(() => state.detailCount).toBe(1);
  await page.keyboard.press('Escape');
  state.records[0].content.name = { vi: 'Phiên mới nhất' };
  await edit(page);
  await expect(nameField(page)).toHaveValue('Phiên mới nhất');
  gate.release();
  await nameField(page).fill('Đang nhập chưa lưu');
  await expect(nameField(page)).toHaveValue('Đang nhập chưa lưu');
  await page.keyboard.press('Escape');
  state.records[0].content.name = { vi: 'Đã thay đổi ngoài form' };
  await edit(page);
  await expect(nameField(page)).toHaveValue('Đã thay đổi ngoài form');
  expect(state.detailCount).toBe(3);
});

test('closing a loading edit and creating a new exhibit ignores the old response', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  const gate = deferred();
  state.detailHook = async (route, detail) => { await gate.promise; await fulfillMuseum(route, envelope(detail)); };
  await page.goto('/admin/exhibits'); await edit(page);
  await expect.poll(() => state.detailCount).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Thêm hiện vật', exact: true }).click();
  await nameField(page).fill('Bản tạo mới'); gate.release();
  await expect(nameField(page)).toHaveValue('Bản tạo mới');
  await expect(page.getByRole('button', { name: 'Tạo bản nháp', exact: true })).toBeEnabled();
});

test('latest in-review detail cannot be saved even when the list row was editable', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  state.listRows = structuredClone(state.records);
  state.records[0].revisionState = 'in_review';
  await page.goto('/admin/exhibits'); await edit(page);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('đang chờ duyệt');
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toHaveCount(0);
});

test('switching from a pending A edit to B ignores the late A detail', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  const gate = deferred();
  let finished = false;
  state.detailHook = async (route, detail) => {
    if (detail.id === state.records[0].id) await gate.promise;
    await fulfillMuseum(route, envelope(detail)); finished = true;
  };
  await page.goto('/admin/exhibits'); await edit(page);
  await expect.poll(() => state.detailCount).toBe(1);
  await page.keyboard.press('Escape'); await edit(page, 'Hiện vật 2');
  await expect(nameField(page)).toHaveValue('Hiện vật 2');
  finished = false; gate.release();
  await expect.poll(() => finished).toBe(true);
  await expect(nameField(page)).toHaveValue('Hiện vật 2');
});

test('submit-review 422 hydrates fresh detail before marking the media tab', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  state.submitError = true;
  state.listRows = structuredClone(state.records);
  state.records[0].content.name = { vi: 'Bản nháp cần sửa' };
  await page.goto('/admin/exhibits');
  await page.getByRole('row').filter({ hasText: 'Hiện vật 1' }).getByRole('button').nth(2).click();
  await page.getByRole('dialog', { name: 'Xác nhận', exact: true }).getByRole('button', { name: 'Gửi kiểm duyệt', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Media & thuyết minh' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Alt text ảnh (Tiếng Việt)', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('tab', { name: 'Thông tin cơ bản', exact: true }).click();
  await expect(nameField(page)).toHaveValue('Bản nháp cần sửa');
});
