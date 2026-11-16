import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

test.setTimeout(180_000);

test('the public 3D navigation carries the current step and pauses a 2D tour', async ({ page }) => {
  const first = roomA.exhibits[0];
  await installMuseumApi(page);
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  await page.getByRole('link', { name: 'Tham quan 3D', exact: true }).click();

  await expect(page).toHaveURL(`/tour?room=sculpture&exhibit=${first.id}`);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true })).toHaveCount(0);
});

test('the collection 3D link transfers a running tour at its current CMS step', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/collection?room=sculpture');
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();

  const transfer = page.getByRole('link', { name: 'Tiếp tục trong 3D', exact: true });
  await expect(transfer).toHaveAttribute('href', `/tour?room=sculpture&exhibit=${roomA.exhibits[1].id}`);
  await transfer.click();
  await expect(page).toHaveURL(`/tour?room=sculpture&exhibit=${roomA.exhibits[1].id}`);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true })).toHaveCount(0);
});

test('a blocked 3D step transfers to its matching paused 2D detail', async ({ page }) => {
  const exhibits = roomA.exhibits.map((exhibit, index) => index === 1 ? { ...exhibit, positionX: 40 } : exhibit);
  await installMuseumApi(page);
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/collection/sculpture/exhibits/${exhibits[0].id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục trong 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  const controls3d = page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
  await expect(page.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(controls3d).toHaveAttribute('data-phase', 'viewing');
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(controls3d).toHaveAttribute('data-phase', 'blocked');

  await page.getByRole('button', { name: 'Tiếp tục trong 2D', exact: true }).click();
  await expect(page).toHaveURL(`/collection/sculpture/exhibits/${exhibits[1].id}`);
  const controls2d = page.getByRole('region', { name: 'Điều khiển tham quan 2D', exact: true });
  await expect(controls2d).toContainText('2/5');
  await expect(controls2d).toContainText('Đã tạm dừng');
});

test('a moving 3D camera is cancelled before transferring to 2D', async ({ page }) => {
  const first = roomA.exhibits[0];
  const second = roomA.exhibits[1];
  await installMuseumApi(page);
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục trong 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();
  const controls3d = page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(controls3d).toHaveAttribute('data-phase', 'moving');

  await page.getByRole('button', { name: 'Tiếp tục trong 2D', exact: true }).click();
  await expect(page).toHaveURL(`/collection/sculpture/exhibits/${second.id}`);
  const controls2d = page.getByRole('region', { name: 'Điều khiển tham quan 2D', exact: true });
  await expect(controls2d).toContainText('2/5');
  await expect(controls2d).toContainText('Đã tạm dừng');
});

test('repeated WebGL loss falls back to the current paused tour step in 2D', async ({ page }) => {
  const first = roomA.exhibits[0];
  await installMuseumApi(page);
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục trong 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();

  for (let loss = 0; loss < 2; loss++) {
    await page.getByLabel('Phòng trưng bày 3D', { exact: true }).evaluate((canvas: HTMLCanvasElement) => {
      const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
      Reflect.set(window, 'restoreGuidedContext', () => extension.restoreContext());
      extension.loseContext();
    });
    await expect(page.locator('[data-webgl-status="recovering"]')).toBeVisible();
    await page.evaluate(() => Reflect.get(window, 'restoreGuidedContext')());
    await expect(page.locator('[data-webgl-status="ready"]')).toBeVisible();
  }
  await page.getByLabel('Phòng trưng bày 3D', { exact: true }).evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D', exact: true }).click();

  await expect(page).toHaveURL(`/collection/sculpture/exhibits/${first.id}`);
  const controls2d = page.getByRole('region', { name: 'Điều khiển tham quan 2D', exact: true });
  await expect(controls2d).toContainText('1/5');
  await expect(controls2d).toContainText('Đã tạm dừng');
});

test('a hidden tab pauses the current dwell without advancing the tour', async ({ page }) => {
  const first = roomA.exhibits[0];
  await installMuseumApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục trong 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();

  const controls = page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
  await expect(controls).toHaveAttribute('data-phase', 'viewing', { timeout: 30_000 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(controls).toHaveAttribute('data-status', 'paused');
  await page.waitForTimeout(16_000);
  await expect(controls).toHaveAttribute('data-exhibit', first.id);
  await expect(controls).toHaveAttribute('data-status', 'paused');
});

test('keeps one paused tour and its remaining 3D dwell across 2D ↔ 3D routes', async ({ page }) => {
  const first = roomA.exhibits[0];
  await installMuseumApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();

  await page.getByRole('button', { name: 'Tiếp tục trong 3D', exact: true }).click();
  await expect(page).toHaveURL(`/tour?room=sculpture&exhibit=${first.id}`);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  const controls3d = page.getByRole('region', { name: 'Tham quan có hướng dẫn', exact: true });
  await expect(controls3d).toHaveAttribute('data-status', 'paused');
  await expect(page.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(controls3d).toHaveAttribute('data-phase', 'viewing', { timeout: 30_000 });
  await page.waitForTimeout(5_000);

  await page.getByRole('button', { name: 'Tiếp tục trong 2D', exact: true }).click();
  const controls2d = page.getByRole('region', { name: 'Điều khiển tham quan 2D', exact: true });
  await expect(page).toHaveURL(`/collection/sculpture/exhibits/${first.id}`);
  await expect(controls2d).toContainText('Đã tạm dừng');
  await expect(controls2d).toContainText('1/5');
  await page.waitForTimeout(30_000);
  await expect(page).toHaveURL(new RegExp(`${first.id}$`));
  await expect(controls2d).toContainText('1/5');

  await page.getByRole('button', { name: 'Tiếp tục trong 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(controls3d).toHaveAttribute('data-status', 'paused');
  await expect(page.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(controls3d).toHaveAttribute('data-phase', 'viewing', { timeout: 30_000 });
  await page.waitForTimeout(9_000);
  await expect(controls3d).toHaveAttribute('data-exhibit', first.id);
  await page.waitForTimeout(2_000);
  await expect(controls3d).toHaveAttribute('data-exhibit', roomA.exhibits[1].id);
});
