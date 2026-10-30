import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('notes autosave plain text, survive immediate navigation/reload, stay isolated and delete', async ({ page }) => {
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  const note = page.getByRole('textbox', { name: 'Ghi chú của bạn', exact: true });
  await expect(note).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Ghi chú chỉ được lưu trên trình duyệt này', { exact: true })).toBeVisible();
  await note.fill('<b>Ghi chú riêng</b>');
  await page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); }, `/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
  await expect(note).toHaveValue('');
  await note.fill('Ghi chú phòng gốm');
  await page.goBack();
  await expect(note).toHaveValue('<b>Ghi chú riêng</b>');
  await page.reload();
  await expect(note).toHaveValue('<b>Ghi chú riêng</b>');
  await expect(page.locator('main b')).toHaveCount(0);
  await note.fill('x'.repeat(2001));
  await expect(note).toHaveValue('x'.repeat(2000));
  await page.getByRole('button', { name: 'Xóa ghi chú', exact: true }).press('Enter');
  await expect(note).toBeFocused();
  await expect(note).toHaveValue('');
  await page.reload();
  await expect(note).toHaveValue('');
});

test('quota failure preserves typed note in memory, retry persists it, and no content is sent', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', req => { if (req.method() !== 'GET' && !req.url().includes('/auth/')) writes.push(req.url()); });
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  const note = page.getByRole('textbox', { name: 'Ghi chú của bạn', exact: true });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, 'restoreVisitorStorage', { value: () => { Storage.prototype.setItem = original; } });
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  });
  await note.fill('Nội dung chưa lưu');
  await expect(note).toHaveValue('Nội dung chưa lưu');
  const region = page.getByRole('region', { name: 'Ghi chú riêng' });
  await expect(region.getByText(/Không thể lưu trên trình duyệt/)).toBeVisible();
  await page.evaluate(() => (window as unknown as { restoreVisitorStorage: () => void }).restoreVisitorStorage());
  await region.getByRole('button', { name: 'Thử lưu lại ghi chú' }).click();
  await expect(region.getByText(/Đã lưu ghi chú trên trình duyệt/)).toBeVisible();
  await page.reload();
  await expect(note).toHaveValue('Nội dung chưa lưu');
  expect(writes).toEqual([]);
});
