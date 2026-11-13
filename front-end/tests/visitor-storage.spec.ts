import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA, roomB } from './fixtures/museumContent';

test('quota retry merges unrelated notes saved by another tab and preserves local deletion', async ({ page, context }) => {
  await installMuseumApi(page);
  const second = await context.newPage();
  await installMuseumApi(second);
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await second.goto(`/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
  const note = (tab: typeof page) => tab.getByRole('textbox', { name: 'Ghi chú của bạn', exact: true });
  await note(page).fill('Bản cũ');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, 'restoreVisitorStorage', { value: () => { Storage.prototype.setItem = original; } });
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: 'Xóa ghi chú', exact: true }).click();
  await note(second).fill('Ghi chú tab B');
  await note(page).fill('Bản nháp A');
  await note(second).fill('Ghi chú tab B mới');
  await page.evaluate(() => (window as unknown as { restoreVisitorStorage: () => void }).restoreVisitorStorage());
  await page.getByRole('button', { name: 'Thử lưu lại ghi chú' }).click();
  await page.reload(); await second.reload();
  await expect(note(page)).toHaveValue('Bản nháp A');
  await expect(note(second)).toHaveValue('Ghi chú tab B mới');
  await second.close();
});

test('blocked storage leaves controls usable in memory and reading invalid data resets safely', async ({ page }) => {
  await installMuseumApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  const favorite = page.getByRole('button', { name: 'Yêu thích Hiện vật 1', exact: true });
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  const notes = page.getByRole('region', { name: 'Ghi chú riêng' });
  await notes.getByRole('textbox').fill('Ghi chú trong RAM');
  await expect(notes.getByRole('textbox')).toHaveValue('Ghi chú trong RAM');
  await expect(notes.getByText(/Không thể lưu trên trình duyệt/)).toBeVisible();
  await page.getByRole('button', { name: 'Chế độ đọc', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Cỡ chữ đọc' })).toHaveText('Cỡ chữ 100%');
});

test('history restores at most twenty valid refs and corrupt reading preferences fall back', async ({ page }) => {
  await installMuseumApi(page);
  await page.addInitScript(({ roomId, currentId }) => {
    const refs = Array.from({ length: 20 }, (_, i) => ({ roomId, exhibitId: `10000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}` }));
    localStorage.setItem('aura:visitor:recent:v1', JSON.stringify({ version: 1, value: refs }));
    localStorage.setItem('aura:visitor:reading:v1', JSON.stringify({ version: 1, value: { enabled: true, fontScale: 99 } }));
    localStorage.setItem('aura:visitor:favorites:v1', JSON.stringify({ version: 1, value: [{ roomId, exhibitId: currentId }] }));
  }, { roomId: roomA.id, currentId: roomA.exhibits[0].id });
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('button', { name: 'Chế độ đọc', exact: true })).toHaveAttribute('aria-pressed', 'false');
  const refs = await page.evaluate(() => JSON.parse(localStorage.getItem('aura:visitor:recent:v1')!).value);
  expect(refs).toHaveLength(20);
  expect(refs[0]).toEqual({ roomId: roomA.id, exhibitId: roomA.exhibits[0].id });
  expect(refs.at(-1).exhibitId).toBe('10000000-0000-4000-8000-000000000020');
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Đã xem gần đây' }).getByRole('link')).toHaveCount(5);
});
