import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('a direct public exhibit URL selects the exhibit without opening WebGL', async ({ page }) => {
  const exhibit = roomA.exhibits[1];
  const sceneRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('MuseumScene')) sceneRequests.push(request.url());
  });

  await page.goto(`/tour?room=sculpture&exhibit=${exhibit.id}`);

  const selected = page.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true });
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: exhibit.name, exact: true })).toBeFocused();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(sceneRequests).toEqual([]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('the 2D detail link opens the same public exhibit in the tour', async ({ page }) => {
  const exhibit = roomA.exhibits[0];
  await page.goto(`/collection/sculpture/exhibits/${exhibit.id}`);
  await page.getByRole('link', { name: 'Xem trong không gian 3D' }).click();

  await expect(page).toHaveURL(`/tour?room=sculpture&exhibit=${exhibit.id}`);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibit.name);
});

test('an invalid exhibit UUID is reported only after its public room has loaded', async ({ page }) => {
  let releaseRoom!: () => void;
  let roomRequestStarted!: () => void;
  const roomStarted = new Promise<void>((resolve) => { roomRequestStarted = resolve; });
  const responseGate = new Promise<void>((resolve) => { releaseRoom = resolve; });
  await page.route('**/api/rooms/sculpture', async (route) => {
    roomRequestStarted();
    await responseGate;
    await fulfillMuseum(route, envelope(roomA));
  });

  await page.goto('/tour?room=sculpture&exhibit=not-a-uuid');
  await roomStarted;
  await expect(page.getByRole('status')).not.toHaveText('Mã hiện vật trong đường dẫn không hợp lệ.');
  await expect(page.getByRole('complementary')).toHaveCount(0);

  releaseRoom();
  await expect(page.getByRole('status')).toHaveText('Mã hiện vật trong đường dẫn không hợp lệ.');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('a missing or cross-room public exhibit never selects stale content', async ({ page }) => {
  for (const exhibitId of [roomB.exhibits[0].id, '10000000-0000-4000-8000-000000000099']) {
    await page.goto(`/tour?room=sculpture&exhibit=${exhibitId}`);

    await expect(page.getByRole('status')).toHaveText('Không tìm thấy hiện vật trong phòng này.');
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
  }
});

test('an unknown room keeps its existing public-room error without using the exhibit ID', async ({ page }) => {
  await page.goto(`/tour?room=unknown&exhibit=${roomA.exhibits[0].id}`);

  await expect(page.getByRole('alert')).toContainText('Phòng được chọn không có trong danh sách công khai');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('a valid deep link recovers after the room API fails and is retried', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/rooms/sculpture', async (route) => {
    requests += 1;
    if (requests === 1) {
      await fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503);
      return;
    }
    await fulfillMuseum(route, envelope(roomA));
  });
  const exhibit = roomA.exhibits[0];

  await page.goto(`/tour?room=sculpture&exhibit=${exhibit.id}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại' }).click();

  await expect(page.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibit.name);
  expect(requests).toBe(2);
});
