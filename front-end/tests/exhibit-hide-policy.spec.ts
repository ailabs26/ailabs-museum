import { expect, test } from '@playwright/test';
import { installExhibitDeletionApi } from './fixtures/exhibitDeletionApi';
import { deferred } from './fixtures/exhibitEditApi';

test('hide uses the current version and preserves published history while disabling delete', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  const record = state.records[0]; record.publishedRevisionId = 'published'; record.visibility = 'visible'; record.status = 'published';
  record.revisions = [{ id: 'published', revisionNo: 1, state: 'approved', createdById: 'actor', createdBy: null, reviewedById: null, reviewedBy: null, reason: null, createdAt: '2026-10-22T00:00:00Z', reviewedAt: null }];
  await page.goto('/admin/exhibits');
  const media = structuredClone(state.media), history = structuredClone(record.revisions);
  const publicIds = () => page.evaluate(async () => {
    const response = await fetch('/api/rooms/fixture');
    const body = await response.json() as { data: { exhibits: { id: string }[] } };
    return body.data.exhibits.map(item => item.id);
  });
  expect(await publicIds()).toEqual([record.id]);
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
  expect(record.revisions).toEqual(history); expect(state.media).toEqual(media);
  expect(await publicIds()).toEqual([]);
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

test('hiding marks public and related CMS caches stale without clearing unrelated data', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  const record = state.records[0]; record.publishedRevisionId = 'published'; record.visibility = 'visible'; record.status = 'published';
  await page.goto('/admin/exhibits');
  await expect(page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true })).toBeVisible();
  const keys = [['museum-tour', 'room', record.roomId], ['public-room', 'fixture'], ['rooms-all-select'], ['rooms'], ['moderation', 'queue', 1]];
  await page.evaluate(async ({ modulePath, keys }) => {
    const { queryClient } = await import(modulePath);
    for (const key of keys) {
      if (!queryClient.getQueryState(key)) queryClient.setQueryData(key, { fixture: true });
    }
    queryClient.setQueryData(['unrelated-fixture'], { keep: true });
  }, { modulePath: '/src/core/api/query-client.ts', keys });
  await page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true }).click();
  await page.getByRole('button', { name: 'Ẩn khỏi bảo tàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hiện vật', exact: true })).toBeFocused();
  const result = await page.evaluate(async ({ modulePath, keys }) => {
    const { queryClient } = await import(modulePath);
    return { stale: keys.filter(key => key[0] !== 'rooms-all-select').map(key => queryClient.getQueryState(key)?.isInvalidated), unrelated: queryClient.getQueryData(['unrelated-fixture']) };
  }, { modulePath: '/src/core/api/query-client.ts', keys });
  // Active room choices refetch immediately and clear their stale flag; inactive caches stay stale.
  expect(result.stale).toEqual(keys.filter(key => key[0] !== 'rooms-all-select').map(() => true));
  expect(result.unrelated).toEqual({ keep: true });
  expect(state.records[0].publishedRevisionId).toBe('published');
});

for (const permission of ['exhibit:update', 'revision:hide']) {
  test(`deletion and hiding keep separate permission checks (${permission})`, async ({ page }) => {
    const state = await installExhibitDeletionApi(page, ['exhibit:read', permission]);
    const record = state.records[0]; record.publishedRevisionId = 'published'; record.visibility = 'visible'; record.status = 'published';
    await page.goto('/admin/exhibits');
    await expect(page.getByRole('button', { name: 'Xóa hiện vật Hiện vật 1', exact: true })).toHaveCount(permission === 'exhibit:update' ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true })).toHaveCount(permission === 'revision:hide' ? 1 : 0);
    if (permission === 'revision:hide') {
      await page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true }).click();
      await page.getByRole('button', { name: 'Ẩn khỏi bảo tàng', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true })).toHaveCount(0);
      expect(state.writes).toHaveLength(1);
    }
  });
}

test('hide stays locked while its fresh-detail request is pending', async ({ page }) => {
  const state = await installExhibitDeletionApi(page);
  const record = state.records[0]; record.publishedRevisionId = 'published'; record.visibility = 'visible'; record.status = 'published';
  await page.goto('/admin/exhibits');
  const gate = deferred(); state.detailGate = gate.promise;
  const hide = page.getByRole('button', { name: 'Ẩn hiện vật Hiện vật 1', exact: true });
  await hide.click();
  await page.getByRole('button', { name: 'Ẩn khỏi bảo tàng', exact: true }).click();
  await expect(hide).toBeDisabled();
  expect(state.writes).toEqual([]);
  gate.release();
  await expect(hide).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
