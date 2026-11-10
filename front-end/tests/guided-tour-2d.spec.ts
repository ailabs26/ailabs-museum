import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB, roomC, roomSummaries } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('collection starts from published order even when the grid is filtered', async ({ page }) => {
  const ordered = [...roomA.exhibits].reverse().map((item, index) => ({ ...item, displayOrder: index + 1 }));
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: ordered })));
  await page.goto('/collection?room=sculpture');
  await page.getByRole('button', { name: `Yêu thích ${ordered[1].name}`, exact: true }).click();
  await page.getByRole('checkbox', { name: 'Chỉ hiện vật yêu thích trong phòng này' }).check();
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).fill(ordered[1].name);
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/collection/sculpture/exhibits/${ordered[0].id}$`));
  await expect(page.getByRole('heading', { name: ordered[0].name, exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toContainText('1/5');
});

test('detail tour controls keep core status and route in sync, including direct-link start', async ({ page }) => {
  const first = roomA.exhibits[0];
  const second = roomA.exhibits[1];
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await expect(page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  const controls = page.getByRole('region', { name: 'Điều khiển tham quan 2D' });
  await expect(controls).toContainText('1/5');
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${second.id}$`));
  await expect(controls).toContainText('2/5');
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(controls).toContainText('Đã tạm dừng');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(controls).toContainText('Đang tham quan');
  await page.getByRole('button', { name: 'Hiện vật trước', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${first.id}$`));
  await page.getByRole('button', { name: 'Thoát hướng dẫn', exact: true }).click();
  await expect(controls).toHaveCount(0);
});

test('rapid Next clicks advance one guided step only', async ({ page }) => {
  await page.goto('/collection?room=sculpture');
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[0].id}$`));
  const next = page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true });
  await next.evaluate(button => { button.click(); button.click(); });
  await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[1].id}$`));
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toContainText('2/5');
});

test('a one-exhibit tour completes without wrapping and restarts only on request', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: [roomA.exhibits[0]] })));
  const first = roomA.exhibits[0];
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${first.id}$`));
  const controls = page.getByRole('region', { name: 'Điều khiển tham quan 2D' });
  await expect(controls).toContainText('Hoàn thành');
  await expect(controls.getByRole('button', { name: 'Hiện vật tiếp theo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bắt đầu lại', exact: true }).click();
  await expect(controls).toContainText('1/1');
  await expect(controls).toContainText('Đang tham quan');
});

test('browser history does not force the active guided step back into the URL', async ({ page }) => {
  const first = roomA.exhibits[0];
  const second = roomA.exhibits[1];
  await page.goto('/collection?room=sculpture');
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  await page.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${second.id}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${first.id}$`));
  await expect(page.getByRole('region', { name: 'Phục hồi bước tham quan' }).getByRole('status'))
    .toContainText(`Hành trình đang ở hiện vật ${second.name}`);
  await expect(page.getByRole('button', { name: 'Quay lại bước đang tham quan', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Quay lại bước đang tham quan', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${second.id}$`));
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toContainText('2/5');
});

test('empty rooms explain why a 2D tour cannot start', async ({ page }) => {
  await page.route('**/api/rooms/empty', route => fulfillMuseum(route, envelope(roomC)));
  await page.goto('/collection?room=empty');
  await expect(page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true })).toBeDisabled();
  await expect(page.getByText('Phòng này chưa có hiện vật được xuất bản.', { exact: true })).toBeVisible();
});

test('collection can continue or exit the same room tour and starts another room only by request', async ({ page }) => {
  await page.goto('/collection?room=sculpture');
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  const first = roomA.exhibits[0];
  await expect(page).toHaveURL(new RegExp(`${first.id}$`));
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();
  await expect(page.getByRole('button', { name: 'Tiếp tục tham quan', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D', exact: true })).toBeVisible();
  await page.getByRole('button', { name: roomB.name, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiếp tục tham quan', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/collection/ceramics/exhibits/${roomB.exhibits[0].id}$`));
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();
  await page.getByRole('button', { name: 'Gốm Việt', exact: true }).click();
  await page.getByRole('button', { name: 'Thoát hướng dẫn', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true })).toBeVisible();
});

test('tour state and controls remain stable across all six locales', async ({ page }) => {
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  const select = page.getByRole('combobox', { name: 'Ngôn ngữ' });
  const names = [
    ['vi', 'Hiện vật tiếp theo', 'Điều khiển tham quan 2D', 'Tiến độ tham quan'],
    ['en', 'Next exhibit', '2D guided tour controls', 'Tour progress'],
    ['fr', 'Objet suivant', 'Commandes de visite guidée 2D', 'Progression de la visite'],
    ['zh', '下一件展品', '2D 导览控制', '导览进度'],
    ['ko', '다음 전시물', '2D 가이드 투어 컨트롤', '투어 진행률'],
    ['ja', '次の展示物', '2D ガイドツアー操作', 'ツアーの進行状況'],
  ];
  for (const [locale, nextLabel, regionLabel, progressLabel] of names) {
    await select.selectOption(locale);
    await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[0].id}$`));
    await expect(page.getByRole('button', { name: nextLabel, exact: true })).toBeVisible();
    const controls = page.getByRole('region', { name: regionLabel, exact: true });
    await expect(controls).toBeVisible();
    await expect(controls.getByRole('progressbar', { name: progressLabel })).toBeVisible();
  }
});

test('controls stay in the viewport and support keyboard navigation on a narrow screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await page.getByRole('button', { name: 'Bắt đầu từ hiện vật này', exact: true }).click();
  const controls = page.getByRole('region', { name: 'Điều khiển tham quan 2D' });
  const bounds = await controls.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await expect(controls.getByRole('progressbar', { name: 'Tiến độ tham quan' })).toHaveAttribute('aria-valuenow', '20');
  await page.screenshot({ path: testInfo.outputPath('guided-tour-2d-320.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('guided-tour-2d-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: testInfo.outputPath('guided-tour-2d-desktop.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = '200%'; });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const next = controls.getByRole('button', { name: 'Hiện vật tiếp theo', exact: true });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[1].id}$`));
  await expect(page.getByRole('heading', { name: roomA.exhibits[1].name, exact: true, level: 1 })).toBeFocused();
});

test('reconciliation keeps a current public ID through reorder and offers a paused fallback after removal', async ({ page }) => {
  let currentRoom = roomA;
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope(currentRoom)));
  await page.goto('/collection?room=sculpture');
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[0].id}$`));
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();
  currentRoom = { ...roomA, exhibits: [...roomA.exhibits].reverse().map((item, index) => ({ ...item, displayOrder: index + 1 })) };
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tiếp tục tham quan', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục tham quan', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[0].id}$`));
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toContainText('5/5');

  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();
  currentRoom = { ...currentRoom, exhibits: currentRoom.exhibits.filter((item) => item.id !== roomA.exhibits[0].id) };
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[0].id}$`));
  await expect(page.getByRole('button', { name: 'Quay lại bước đang tham quan', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Quay lại bước đang tham quan', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${roomA.exhibits[1].id}$`));
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toContainText('4/4');
  await expect(page.getByRole('region', { name: 'Điều khiển tham quan 2D' })).toContainText('Đang tham quan');
});

test('transient room-list errors keep the session, while a successful removal invalidates it', async ({ page }) => {
  test.setTimeout(60_000);
  let listStatus = 200;
  let summaries = roomSummaries;
  await page.route('**/api/rooms', route => fulfillMuseum(route,
    listStatus === 200 ? envelope(summaries) : { success: false, data: null, message: 'Unavailable' }, listStatus));
  await page.goto('/collection?room=sculpture');
  await page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true }).click();
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();

  listStatus = 503;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  listStatus = 200;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('button', { name: 'Tiếp tục tham quan', exact: true })).toBeVisible();

  summaries = roomSummaries.filter((room) => room.id !== roomA.id);
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Phòng được chọn không có trong danh sách công khai');
  await page.getByRole('button', { name: roomB.name, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu tham quan 2D', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiếp tục tham quan', exact: true })).toHaveCount(0);
});
