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

test('seeds the saved row while list refetch waits and a second save preserves the new values', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  const gate = deferred();
  await page.goto('/admin/exhibits'); await edit(page);
  await expect(nameField(page)).toHaveValue('Hiện vật 1');
  await nameField(page).fill('Tên đã lưu');
  await page.getByRole('textbox', { name: 'Mô tả hiện vật (Tiếng Việt)', exact: true }).fill('Mô tả đã lưu');
  await page.getByRole('tab', { name: 'Media & thuyết minh' }).click();
  await page.getByRole('textbox', { name: 'Hình ảnh hiện vật', exact: true }).click();
  await page.getByRole('option', { name: /image-2/ }).click();
  await page.getByRole('textbox', { name: 'Audio thuyết minh (MP3)', exact: true }).click();
  await page.getByRole('option', { name: /audio-2/ }).click();
  state.listHook = async (route, rows) => {
    await gate.promise;
    await fulfillMuseum(route, { ...envelope(rows), meta: { page: 1, pageSize: 15, total: 2 } });
  };
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Đã lưu bản nháp hiện vật "Tên đã lưu"', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Tên đã lưu' })).toBeVisible();
  await edit(page, 'Tên đã lưu');
  await expect(nameField(page)).toHaveValue('Tên đã lưu');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect.poll(() => state.patches.length).toBe(2);
  expect(state.patches[1].body.name).toEqual({ vi: 'Tên đã lưu' });
  expect(state.patches[1].body.description).toEqual({ vi: 'Mô tả đã lưu' });
  expect(state.patches[1].body.imageId).toBe('90000000-0000-4000-8000-000000000002');
  expect(state.patches[1].body.audioViId).toBe('90000000-0000-4000-8000-000000000012');
  expect(state.requests.some(path => /submit-review|publish/.test(path))).toBe(false);
  gate.release();
});

test('saving empty slots retains null semantics when reopening after a failed list refresh', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  state.records[0].content.imageId = '90000000-0000-4000-8000-000000000001';
  state.records[0].content.audioViId = '90000000-0000-4000-8000-000000000011';
  await page.goto('/admin/exhibits'); await edit(page);
  await expect(nameField(page)).toHaveValue('Hiện vật 1');
  await page.getByRole('tab', { name: 'Media & thuyết minh' }).click();
  for (const label of ['Hình ảnh hiện vật', 'Audio thuyết minh (MP3)']) {
    const input = page.getByRole('textbox', { name: label, exact: true });
    await input.click();
    const option = label === 'Hình ảnh hiện vật' ? /image-1/ : /audio-1/;
    await page.getByRole('option', { name: option }).click();
  }
  state.listHook = async route => { await fulfillMuseum(route, { success: false, data: null, message: 'List unavailable' }, 503); };
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await edit(page);
  await expect(nameField(page)).toHaveValue('Hiện vật 1');
  await page.getByRole('tab', { name: 'Media & thuyết minh' }).click();
  await expect(page.getByRole('textbox', { name: 'Hình ảnh hiện vật', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Audio thuyết minh (MP3)', exact: true })).toHaveValue('');
  expect(state.patches[0].body.imageId).toBeNull();
  expect(state.patches[0].body.audioViId).toBeNull();
});

test('an obsolete submit-review error cannot reopen a different edit session', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  const gate = deferred();
  await page.route('**/api/admin/exhibits/*/submit-review', async route => {
    await gate.promise;
    await fulfillMuseum(route, { success: false, data: null, message: 'Thiếu alt text', errors: [{ field: 'altText.vi', code: 'required', message: 'Cần alt text' }] }, 422);
  });
  await page.goto('/admin/exhibits');
  await page.getByRole('row').filter({ hasText: 'Hiện vật 1' }).getByRole('button').nth(2).click();
  const submitted = page.waitForRequest(request => request.url().endsWith('/submit-review') && request.method() === 'POST');
  await page.getByRole('dialog', { name: 'Xác nhận', exact: true }).getByRole('button', { name: 'Gửi kiểm duyệt', exact: true }).click();
  await submitted;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await edit(page, 'Hiện vật 2');
  await expect(nameField(page)).toHaveValue('Hiện vật 2');
  await nameField(page).fill('Chưa lưu ở B');
  const response = page.waitForResponse(res => res.url().endsWith('/submit-review'));
  gate.release(); await response;
  // Wait for the query/mutation callbacks as well as the network response.
  await expect.poll(() => state.detailCount).toBe(1);
  await expect(nameField(page)).toHaveValue('Chưa lưu ở B');
  await expect(page.getByRole('tab', { name: 'Thông tin cơ bản', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('background detail refresh does not replace unsaved form input', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  await page.goto('/admin/exhibits'); await edit(page);
  await expect(nameField(page)).toHaveValue('Hiện vật 1');
  await nameField(page).fill('Nội dung chưa lưu');
  state.records[0].content.name = { vi: 'Nội dung server mới hơn' };
  await page.evaluate(async ({ modulePath, id }) => {
    const { queryClient } = await import(modulePath);
    await queryClient.fetchQuery({ queryKey: ['admin-exhibit-detail', id], staleTime: 0,
      queryFn: async () => {
        const old = queryClient.getQueryData(['admin-exhibit-detail', id]);
        return { ...old, content: { ...old.content, name: { vi: 'Refetch nền' } } };
      } });
  }, { modulePath: '/src/core/api/query-client.ts', id: state.records[0].id });
  await expect(nameField(page)).toHaveValue('Nội dung chưa lưu');
});

test('saving updates only existing list entries and cancels a pre-save stale request', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  await page.goto('/admin/exhibits'); await edit(page);
  await expect(nameField(page)).toHaveValue('Hiện vật 1');
  const original = structuredClone(state.records);
  await page.evaluate(async ({ modulePath, records }) => {
    const { queryClient } = await import(modulePath);
    queryClient.setQueryData(['admin-exhibits', 'cached-filter'], { items: records, page: 2, pageSize: 15, total: 30 });
    queryClient.setQueryData(['admin-exhibits', 'unrelated-filter'], { items: [records[1]], page: 1, pageSize: 15, total: 1 });
  }, { modulePath: '/src/core/api/query-client.ts', records: original });
  const gate = deferred();
  let oldRequestStarted = false;
  state.listHook = async (route, rows) => {
    oldRequestStarted = true;
    await gate.promise;
    await fulfillMuseum(route, { ...envelope(rows), meta: { page: 1, pageSize: 15, total: 2 } });
  };
  await page.evaluate(async modulePath => {
    const { queryClient } = await import(modulePath);
    void queryClient.invalidateQueries({ queryKey: ['admin-exhibits'] });
  }, '/src/core/api/query-client.ts');
  await expect.poll(() => oldRequestStarted).toBe(true);
  await nameField(page).fill('Tên được giữ sau lưu');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Tên được giữ sau lưu' })).toBeVisible();
  const caches = await page.evaluate(async modulePath => {
    const { queryClient } = await import(modulePath);
    return { filtered: queryClient.getQueryData(['admin-exhibits', 'cached-filter']), unrelated: queryClient.getQueryData(['admin-exhibits', 'unrelated-filter']) };
  }, '/src/core/api/query-client.ts');
  expect(caches.filtered.items.map((item: { id: string }) => item.id)).toEqual(original.map(item => item.id));
  expect(caches.filtered.items[0].content.name).toEqual({ vi: 'Tên được giữ sau lưu' });
  expect(caches.filtered.items[1]).toEqual(original[1]);
  expect({ page: caches.filtered.page, total: caches.filtered.total, pageSize: caches.filtered.pageSize }).toEqual({ page: 2, total: 30, pageSize: 15 });
  expect(caches.unrelated.items).toEqual([original[1]]);
  gate.release();
  await expect(page.getByRole('row').filter({ hasText: 'Tên được giữ sau lưu' })).toBeVisible();
});

test('saves every field from one detail revision and preserves hotspots on a second save', async ({ page }) => {
  const state = await installExhibitEditApi(page);
  state.listRows = structuredClone(state.records);
  const record = state.records[0];
  Object.assign(record.content, {
    name: { vi: 'Tên detail', en: 'Detail name' }, description: { vi: 'Mô tả detail', en: 'Detail description' },
    position: { x: 2, y: 3, z: 4 }, rotation: { x: 0.1, y: 0.2, z: 0.3 }, scale: { x: 2, y: 2, z: 2 },
    placeholderShape: 'sphere', placeholderColor: '#123456',
    modelId: '90000000-0000-4000-8000-000000000021', imageId: '90000000-0000-4000-8000-000000000001',
    audioViId: '90000000-0000-4000-8000-000000000011', audioEnId: '90000000-0000-4000-8000-000000000012',
    subtitleViId: '90000000-0000-4000-8000-000000000031', subtitleEnId: '90000000-0000-4000-8000-000000000032',
    altText: { vi: 'Ảnh detail', en: 'Detail image' }, transcript: { vi: 'Thuyết minh', en: 'Narration' },
  });
  record.displayOrder = 7;
  record.hotspots = [{ id: '80000000-0000-4000-8000-000000000001', label: JSON.stringify({ vi: 'Điểm A', en: 'Point A' }),
    body: JSON.stringify({ vi: 'Nội dung A', en: 'Body A' }), position: { x: 1, y: 2, z: 3 }, displayOrder: 1 }];
  const expectedContent = structuredClone(record.content);
  await page.goto('/admin/exhibits'); await edit(page);
  await expect(nameField(page)).toHaveValue('Tên detail');
  state.listRows = null;
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await edit(page, 'Tên detail');
  await expect(nameField(page)).toHaveValue('Tên detail');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect.poll(() => state.patches.length).toBe(2);
  for (const patch of state.patches) {
    expect(patch.body).toMatchObject(expectedContent);
    expect(patch.body.displayOrder).toBe(7);
    expect(patch.body.hotspots).toEqual([{ label: { vi: 'Điểm A', en: 'Point A' }, body: { vi: 'Nội dung A', en: 'Body A' }, positionX: 1, positionY: 2, positionZ: 3, displayOrder: 1 }]);
  }
});
