import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('keyboard catalogue selection has one pressed item and clears on room change', async ({ page }) => {
  await page.goto('/tour');
  const first = page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true });
  await first.focus();
  await first.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  const second = page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true });
  await second.press('Space');
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('detail uses published text, stays nonmodal and Escape restores its trigger', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{
    ...roomA.exhibits[0], description: '<b>Thông tin được duyệt</b>', transcript: 'Thuyết minh đã xuất bản',
    hotspots: [{ id: '20000000-0000-4000-8000-000000000001', label: 'Bề mặt', body: 'Dấu khắc gốc', positionX: 0, positionY: 1, positionZ: 0, displayOrder: 0 }],
  }] })));
  await page.goto('/tour');
  const trigger = page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true });
  await trigger.click();
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('<b>Thông tin được duyệt</b>', { exact: true })).toBeVisible();
  await expect(panel.locator('b')).toHaveCount(0);
  await expect(panel.getByText('Thuyết minh đã xuất bản')).toBeVisible();
  await expect(panel.getByText('Dấu khắc gốc')).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('room changes and failed refresh remove selected details', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('real scene picking selects the plinth and hover gives pointer feedback', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.64);
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.64);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('Hiện vật 1');
  await expect(page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
  await expect(canvas).toBeFocused();
});

test('selecting an exhibit focuses the camera and reset retains published detail', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel).toContainText('Hiện vật 2');
  const capture = { style: 'canvas { outline: none !important; } [aria-label="Điều khiển góc nhìn"] { visibility: hidden !important; }' };
  const focused = await canvas.screenshot(capture);
  await page.getByRole('button', { name: 'Góc nhìn ban đầu' }).click();
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(false);
  await expect(panel).toContainText('Mô tả hiện vật 2');
  const reset = await canvas.screenshot(capture);
  await expect(page.getByRole('button', { name: 'Tập trung hiện vật', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tập trung hiện vật', exact: true }).click();
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(true);
  await canvas.press('ArrowLeft');
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(false);
  await canvas.press('f');
  await expect.poll(async () => (await canvas.screenshot(capture)).equals(focused)).toBe(true);
  expect(focused.equals(reset)).toBe(false);
});

test('outside-room exhibits retain detail but cannot focus the camera outside the gallery', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{ ...roomA.exhibits[0], positionX: 20 }] })));
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText('ngoài phạm vi');
  await expect(page.getByRole('button', { name: 'Tập trung hiện vật', exact: true })).toBeDisabled();
});
