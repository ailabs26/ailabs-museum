import { expect, test } from '@playwright/test';
import { installMedia } from './fixtures/publicMediaApi';

for (const view of ['detail', 'tour']) {
  test(`API audio plays in ${view} and stops when leaving the owner`, async ({ page }) => {
    const room = await installMedia(page);
    const audioRequests: string[] = [];
    page.on('request', request => { if (request.url().includes('/media/uploads/audio/')) audioRequests.push(request.url()); });
    await page.goto(view === 'detail' ? `/collection/${room.slug}/exhibits/${room.exhibits[0].id}` : '/tour');
    if (view === 'tour') await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
    const audio = page.locator('audio');
    const old = await audio.elementHandle();
    expect(audioRequests).toEqual([]);
    await page.getByRole('button', { name: 'Phát', exact: true }).click();
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
    expect(audioRequests.some(url => url.endsWith('/guide.wav'))).toBe(true);
    await expect(page.getByLabel('Phụ đề hiện tại')).toHaveText('Thuyết minh đồng bộ');
    await expect(page.getByText('Thuyết minh', { exact: true })).toBeVisible();
    if (view === 'tour') await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
    else await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();
    await expect.poll(() => old!.evaluate((el: HTMLAudioElement) => ({ paused: el.paused, src: el.getAttribute('src') })))
      .toEqual({ paused: true, src: null });
  });
}

test('two exhibits sharing an audio URL get separate playback owners', async ({ page }) => {
  const room = await installMedia(page);
  room.exhibits.push({ ...structuredClone(room.exhibits[0]), id: '10000000-0000-4000-8000-000000000002', name: 'Hiện vật B' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
  const old = await page.locator('audio').elementHandle();
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect.poll(() => old!.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật B', exact: true }).click();
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
  await expect.poll(() => old!.evaluate((el: HTMLAudioElement) => el.getAttribute('src'))).toBeNull();
});

test('missing Vietnamese audio never falls back to English and text remains readable', async ({ page }) => {
  const room = await installMedia(page);
  room.exhibits[0].audio!.vi = null;
  room.exhibits[0].i18n!.vi.transcript = 'Văn bản tiếng Việt';
  await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
  await expect(page.getByRole('button', { name: 'Phát', exact: true })).toBeDisabled();
  await expect(page.locator('audio')).not.toHaveAttribute('src');
  await expect(page.getByText('Văn bản tiếng Việt', { exact: true })).toBeVisible();
});

test('media failures preserve transcript and allow deliberate retry', async ({ page }) => {
  const room = await installMedia(page);
  await page.route('**/media/uploads/audio/**', route => route.fulfill({ status: 404 }));
  await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
  await expect(page.getByText('Thuyết minh', { exact: true })).toBeVisible();
});

test('Stop and replay restore the first caption even inside the same cue', async ({ page }) => {
  const room = await installMedia(page);
  await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveText('Thuyết minh đồng bộ');
  await page.getByRole('button', { name: 'Dừng', exact: true }).click();
  await expect(page.locator('audio')).toHaveJSProperty('seeking', false);
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveCount(0);
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveText('Thuyết minh đồng bộ');
});

test('time and status retain readable contrast in the dark tour panel', async ({ page }) => {
  await installMedia(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
  const player = page.getByRole('region', { name: 'Thuyết minh audio' });
  const background = await player.evaluate(el => getComputedStyle(el).backgroundColor);
  for (const text of [player.getByLabel('Thời gian hiện tại'), player.getByRole('status')]) {
    const contrast = await text.evaluate((el, bg) => {
      const luminance = (color: string) => {
        const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(value => {
          const channel = Number(value) / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return r * 0.2126 + g * 0.7152 + b * 0.0722;
      };
      const values = [luminance(getComputedStyle(el).color), luminance(bg)];
      return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    }, background);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
});

test('subtitle failure does not prevent audio or reading the transcript', async ({ page }) => {
  const room = await installMedia(page);
  await page.route('**/media/uploads/subtitles/**', route => route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
  await expect(page.getByText('Không tải được phụ đề. Bạn vẫn có thể đọc bản thuyết minh.')).toBeVisible();
  await expect(page.getByText('Thuyết minh', { exact: true })).toBeVisible();
});

test('a failed refresh removes the active playback owner', async ({ page }) => {
  await installMedia(page);
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
  const old = await page.locator('audio').elementHandle();
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect.poll(() => old!.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
  await page.route('**/api/rooms**', route => route.fulfill({ status: 500 }));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.locator('audio')).toHaveCount(0);
  await expect.poll(() => old!.evaluate((el: HTMLAudioElement) => el.getAttribute('src'))).toBeNull();
});

test('late play rejection cannot change the new exhibit sharing the same URL', async ({ page }) => {
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.dataset.pendingPlay === 'true') return new Promise<void>((_, reject) => {
        Reflect.set(window, '__rejectOldGuide', () => reject(new DOMException('stale', 'AbortError')));
      });
      return nativePlay.call(this);
    };
  });
  const room = await installMedia(page);
  room.exhibits.push({ ...structuredClone(room.exhibits[0]), id: '10000000-0000-4000-8000-000000000002', name: 'Hiện vật B' });
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
  await page.locator('audio').evaluate(el => { el.dataset.pendingPlay = 'true'; });
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật B', exact: true }).click();
  await page.evaluate(() => (Reflect.get(window, '__rejectOldGuide') as () => void)());
  await expect(page.getByRole('region', { name: 'Thuyết minh audio' }).getByRole('status')).toHaveText('Sẵn sàng phát');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
});

test('corrupt audio bytes show an error without hiding the transcript', async ({ page }) => {
  const room = await installMedia(page);
  await page.route('**/media/uploads/audio/**', route => route.fulfill({ contentType: 'audio/mpeg', body: 'not MP3', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
  await expect(page.getByText('Thuyết minh', { exact: true })).toBeVisible();
});
