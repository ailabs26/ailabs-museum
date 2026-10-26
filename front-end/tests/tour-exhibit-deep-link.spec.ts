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

test('a deep-linked exhibit keeps its 2D target when the lazy WebGL scene fails', async ({ page }) => {
  await page.route('**/*MuseumScene*', (route) => route.abort());
  const exhibit = roomA.exhibits[1];
  await page.goto(`/tour?room=sculpture&exhibit=${exhibit.id}`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page).toHaveURL(`/tour?room=sculpture&exhibit=${exhibit.id}`);
  await expect(page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D', exact: true }))
    .toHaveAttribute('href', `/collection/sculpture/exhibits/${exhibit.id}`);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibit.name);
  await expect(page.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('opening 3D from a deep link keeps the selected exhibit in the catalogue', async ({ page }) => {
  const exhibit = roomA.exhibits[1];
  await page.goto(`/tour?room=sculpture&exhibit=${exhibit.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();

  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible();
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(exhibit.name);
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

test('changing rooms hides the old deep-linked exhibit while the new room is pending', async ({ page }) => {
  let releaseRoom!: () => void;
  let signalRoomRequest!: () => void;
  const roomRequested = new Promise<void>((resolve) => { signalRoomRequest = resolve; });
  const responseGate = new Promise<void>((resolve) => { releaseRoom = resolve; });
  await page.route('**/api/rooms/ceramics', async (route) => {
    signalRoomRequest();
    await responseGate;
    await fulfillMuseum(route, envelope(roomB));
  });
  const exhibit = roomA.exhibits[0];
  await page.goto(`/tour?room=sculpture&exhibit=${exhibit.id}`);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();

  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await roomRequested;
  await expect(page).toHaveURL('/tour?room=ceramics');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: exhibit.name, exact: true })).toHaveCount(0);

  releaseRoom();
  await expect(page.getByRole('button', { name: `Xem chi tiết ${roomB.exhibits[0].name}`, exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});

test('manual selection and close sync the URL and preserve unrelated parameters', async ({ page }) => {
  const exhibit = roomA.exhibits[0];
  await page.goto('/tour?room=sculpture&campaign=summer');

  const trigger = page.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true });
  await trigger.click();
  await expect(page).toHaveURL(`/tour?room=sculpture&campaign=summer&exhibit=${exhibit.id}`);
  await expect(trigger).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
  await expect(page).toHaveURL('/tour?room=sculpture&campaign=summer');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('Escape closes a direct deep link and focuses the 3D start button', async ({ page }) => {
  const exhibit = roomA.exhibits[0];
  await page.goto(`/tour?room=sculpture&exhibit=${exhibit.id}&campaign=summer`);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page).toHaveURL('/tour?room=sculpture&campaign=summer');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
});

test('selection replaces history while room changes push and restore URL selection', async ({ page }) => {
  await page.goto('/collection', { waitUntil: 'domcontentloaded' });
  await page.goto('/tour?room=sculpture', { waitUntil: 'domcontentloaded' });

  for (const exhibit of roomA.exhibits.slice(0, 2)) {
    await page.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true }).click();
    await expect(page).toHaveURL(`/tour?room=sculpture&exhibit=${exhibit.id}`);
  }
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/collection$/);

  await page.goto(`/tour?room=sculpture&exhibit=${roomA.exhibits[0].id}&campaign=summer`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page).toHaveURL('/tour?room=ceramics&campaign=summer');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(`/tour?room=sculpture&exhibit=${roomA.exhibits[0].id}&campaign=summer`);
  await expect(page.getByRole('button', { name: `Xem chi tiết ${roomA.exhibits[0].name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL('/tour?room=ceramics&campaign=summer');
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
});
