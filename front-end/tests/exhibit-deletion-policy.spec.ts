import { expect, test } from '@playwright/test';
import { installExhibitDeletionApi } from './fixtures/exhibitDeletionApi';
import { editDetail, deferred } from './fixtures/exhibitEditApi';

test('hidden published, approved and in-review records cannot be deleted from the list', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  state.records = [editDetail(1), editDetail(2), editDetail(3)];
  state.records[0].publishedRevisionId = 'published';
  state.records[1].revisionState = 'in_review'; state.records[2].revisionState = 'approved';
  await page.goto('/admin/exhibits');
  for (const record of state.records) {
    await expect(page.getByRole('button', { name: `Xóa hiện vật ${record.content.name && typeof record.content.name === 'object' ? record.content.name.vi : ''}`, exact: true })).toBeDisabled();
  }
  expect(state.writes).toEqual([]);
});

test('fresh detail blocks deletion when an older revision is approved', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  state.records[0].revisions = [{ id: 'approved', revisionNo: 1, state: 'approved', createdById: 'actor', createdBy: null, reviewedById: null, reviewedBy: null, reason: null, createdAt: '2026-10-22T00:00:00Z', reviewedAt: null }];
  await page.goto('/admin/exhibits');
  await page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true }).click();
  await expect(page.getByText(/có lịch sử xuất bản hoặc phê duyệt/).first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('cancel preserves the item, confirmed deletion keeps media and returns focus to the page', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  await page.goto('/admin/exhibits');
  const trigger = page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true });
  await trigger.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Media vẫn được giữ trong thư viện');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(state.writes).toEqual([]);
  await trigger.press('Enter');
  await page.getByRole('button', { name: 'Xóa vĩnh viễn bản nháp', exact: true }).press('Space');
  await expect(page.getByText('Không tìm thấy hiện vật nào phù hợp với bộ lọc.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hiện vật', exact: true })).toBeFocused();
  expect(state.writes.map(item => item.method)).toEqual(['DELETE']);
});

test('report conflict is shown as a reason and does not remove the item', async ({ page }) => {
  const state = await installExhibitDeletionApi(page); state.deleteStatus = 409;
  await page.goto('/admin/exhibits');
  await page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa vĩnh viễn bản nháp', exact: true }).click();
  await expect(page.getByText('Hiện vật có báo cáo liên quan nên không thể xóa vĩnh viễn.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true })).toBeVisible();
  expect(state.records).toHaveLength(1);
});

test('pending delete is not sent twice and deleting the final page item goes to the previous page', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  state.records = Array.from({ length: 16 }, (_, index) => editDetail(index + 1));
  await page.goto('/admin/exhibits'); await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 16', exact: true }).click();
  const gate = deferred(); state.mutationGate = gate.promise;
  await page.getByRole('button', { name: 'Xóa vĩnh viễn bản nháp', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 16', exact: true })).toBeDisabled();
  gate.release();
  await expect(page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
