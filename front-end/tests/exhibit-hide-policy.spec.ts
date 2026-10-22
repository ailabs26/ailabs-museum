import { expect, test } from '@playwright/test';
import { installExhibitDeletionApi } from './fixtures/exhibitDeletionApi';

test('hide uses the current version and preserves published history while disabling delete', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  const record = state.records[0]; record.publishedRevisionId = 'published'; record.visibility = 'visible'; record.status = 'published';
  await page.goto('/admin/exhibits');
  const hide = page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true });
  await hide.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Lịch sử, bản nháp và media vẫn được giữ');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(state.writes).toEqual([]);
  await hide.press('Enter');
  record.version = 9;
  await page.getByRole('button', { name: 'Ẩn khỏi bảo tàng', exact: true }).press('Space');
  await expect(hide).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([{ method: 'POST', path: `/exhibits/${record.id}/hide`, body: { version: 9 } }]);
  expect(record.publishedRevisionId).toBe('published'); expect(record.visibility).toBe('hidden');
});

test('hide conflict refreshes state without retrying or deleting the record', async ({ page }) => {
  const state = await installExhibitDeletionApi(page); state.hideStatus = 409;
  const record = state.records[0]; record.publishedRevisionId = 'published'; record.visibility = 'visible'; record.status = 'published';
  await page.goto('/admin/exhibits');
  await page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true }).click();
  await page.getByRole('button', { name: 'Ẩn khỏi bảo tàng', exact: true }).click();
  await expect(page.getByText('Trạng thái hiện vật vừa thay đổi. Vui lòng tải lại.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1); expect(state.records).toHaveLength(1);
  expect(record.visibility).toBe('visible');
});

for (const permission of ['exhibit:update', 'revision:hide']) {
  test(`deletion and hiding keep separate permission checks (${permission})`, async ({ page }) => {
    const state = await installExhibitDeletionApi(page, ['exhibit:read', permission]);
    const record = state.records[0]; record.publishedRevisionId = 'published'; record.visibility = 'visible'; record.status = 'published';
    await page.goto('/admin/exhibits');
    await expect(page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true })).toHaveCount(permission === 'exhibit:update' ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true })).toHaveCount(permission === 'revision:hide' ? 1 : 0);
  });
}
