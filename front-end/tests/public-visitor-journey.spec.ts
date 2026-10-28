import { expect, test } from '@playwright/test';
import { fulfillMuseum } from './fixtures/museumApi';
import { installMedia } from './fixtures/publicMediaApi';

test('visitor follows 2D detail, audio, transcript and reports content', async ({ page }) => {
  const room = await installMedia(page);
  const exhibit = room.exhibits[0];
  const reports: { method: string; payload: unknown }[] = [];
  const audioRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/media/uploads/audio/')) audioRequests.push(request.url());
  });
  await page.route('**/api/public/reports', async route => {
    if (route.request().method() !== 'POST') {
      await route.abort();
      return;
    }
    reports.push({ method: route.request().method(), payload: route.request().postDataJSON() });
    await fulfillMuseum(route, {
      success: true, message: null,
      data: { id: 'c1111111-1111-4111-8111-111111111111', status: 'open' },
    }, 201);
  });

  await page.goto('/collection');
  await expect(page.getByRole('heading', { level: 1, name: 'Bộ sưu tập', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: room.name, exact: true })).toBeVisible();
  const card = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })
    .getByRole('listitem').filter({ has: page.getByRole('heading', { name: exhibit.name, exact: true }) });
  const detailLink = card.getByRole('link', { name: `Xem chi tiết ${exhibit.name}`, exact: true });
  await detailLink.focus();
  await detailLink.press('Enter');

  const detailPath = `/collection/${encodeURIComponent(room.slug)}/exhibits/${encodeURIComponent(exhibit.id)}`;
  await expect(page).toHaveURL(new URL(detailPath, page.url()).href);
  await expect(page.getByRole('heading', { level: 1, name: exhibit.name, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Câu chuyện hiện vật' })).toContainText(exhibit.description!);
  await expect(page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);

  const player = page.getByRole('region', { name: 'Thuyết minh audio', exact: true });
  const audio = player.locator('audio');
  await expect(audio).toHaveJSProperty('paused', true);
  expect(audioRequests).toEqual([]);
  await player.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  expect(audioRequests).toContain(exhibit.audio!.vi!.audio.url);
  await expect(player.getByLabel('Phụ đề hiện tại')).toHaveText('Thuyết minh đồng bộ');

  const transcript = page.getByRole('region', { name: 'Bản thuyết minh', exact: true });
  await expect(transcript.getByText(exhibit.audio!.vi!.transcript!, { exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(audio).toHaveJSProperty('paused', true);
  await expect(transcript.getByText(exhibit.audio!.vi!.transcript!, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Báo nội dung', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Báo cáo nội dung', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Danh mục').selectOption('wrong_info');
  await dialog.getByLabel('Nội dung bổ sung').fill('  Sai niên đại  ');
  await dialog.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Đã gửi báo cáo nội dung', { exact: true })).toBeVisible();
  expect(reports).toEqual([{ method: 'POST', payload: {
    exhibitId: exhibit.id, reportedRevisionId: exhibit.revisionId,
    category: 'wrong_info', message: 'Sai niên đại',
  } }]);
  await expect(page).toHaveURL(new URL(detailPath, page.url()).href);
  await expect(page.getByRole('heading', { level: 1, name: exhibit.name, exact: true })).toBeVisible();
});
