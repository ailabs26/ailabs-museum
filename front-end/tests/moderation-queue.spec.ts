import { expect, test } from '@playwright/test';
import { installModerationQueueApi, queueRevision } from './fixtures/moderationQueueApi';
import { deferred } from './fixtures/exhibitEditApi';
import { overlayReport } from './fixtures/overlayApi';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

test('bilingual queue names render consistently in the row, action and drawer', async ({ page }) => {
  const state = await installModerationQueueApi(page);
  state.revisions = [queueRevision(1), queueRevision(2)];
  // API payload shape differs from the old string-only client declaration.
  Object.assign(state.revisions[0].content, { name: { vi: 'Bình song ngữ', en: 'Bilingual vase' } });
  Object.assign(state.revisions[1].content, { name: { vi: 'Bình song ngữ', en: 'Duplicate' } });
  await page.goto('/admin/moderation');
  const action = page.getByRole('button', { name: `Xem chi tiết Bình song ngữ, bản #2, ${state.revisions[1].id}`, exact: true });
  await expect(action).toBeVisible(); await action.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Bình song ngữ', exact: true })).toBeVisible();
  await expect(page.getByText('Đã xảy ra lỗi hiển thị')).toHaveCount(0);
});

test('legacy, JSON, English fallback and empty names remain readable', async ({ page }) => {
  const state = await installModerationQueueApi(page);
  state.revisions = ['Tên cũ', '{"vi":"Tên JSON","en":"JSON name"}', { vi: '  ', en: 'English only' }, null].map((name, index) => {
    const revision = queueRevision(index + 1); Object.assign(revision.content, { name }); return revision;
  });
  await page.goto('/admin/moderation');
  for (const name of ['Tên cũ', 'Tên JSON', 'English only', 'Chưa đặt tên']) {
    await expect(page.getByRole('cell', { name, exact: false }).first()).toBeVisible();
  }
});

for (const status of [500, 403]) {
  test(`queue ${status} shows an error and retry instead of the empty state`, async ({ page }) => {
    const state = await installModerationQueueApi(page); state.status = status;
    await page.goto('/admin/moderation');
    await expect(page.getByRole('alert')).toContainText('Không tải được hàng chờ mẫu');
    await expect(page.getByText('Không có phiên bản nào chờ duyệt', { exact: true })).toHaveCount(0);
    state.status = 200; state.revisions = [queueRevision()];
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await expect(page.getByRole('cell', { name: /Bình gốm/ }).first()).toBeVisible();
  });
}

test('pending and successful empty queue are distinct, failed refresh hides cached rows', async ({ page }) => {
  const state = await installModerationQueueApi(page);
  const gate = deferred(); state.gate = gate.promise;
  await page.goto('/admin/moderation');
  await expect(page.getByRole('status')).toContainText('Đang tải hàng chờ');
  gate.release(); state.gate = undefined;
  await expect(page.getByText('Không có phiên bản nào chờ duyệt', { exact: true })).toBeVisible();
  state.revisions = [queueRevision()];
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Bình gốm/ }).first()).toBeVisible();
  state.status = 403;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('reported revision using the shared bilingual type remains readable', async ({ page }) => {
  await installModerationQueueApi(page);
  await page.route(`**/api/reports/${overlayReport.id}`, route => fulfillMuseum(route, envelope({
    ...overlayReport, reportedRevision: { id: 'fixture', revisionNo: 1, state: 'in_review', content: {
      name: { vi: 'Tên trong báo cáo', en: 'Reported name' }, description: { vi: '', en: 'Reported description' },
    } },
  })));
  await page.goto('/admin/reports');
  await page.getByRole('cell', { name: 'Báo cáo mẫu' }).click();
  await expect(page.getByRole('dialog').getByText('Tên trong báo cáo', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Reported description', { exact: true })).toBeVisible();
});
