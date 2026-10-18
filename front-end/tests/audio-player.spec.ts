import { expect, test } from '@playwright/test';
import { createWavFixture } from './fixtures/audioFixture';

test.beforeEach(async ({ page }) => {
  await page.route('**/audio-fixture.wav', async (route) => {
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: createWavFixture() });
  });
  await page.route('**/audio-fixture-2.wav', async (route) => {
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: createWavFixture(8, 11025) });
  });
});

test('shows an unavailable state when no audio source is provided', async ({ page }) => {
  await page.goto('/tests/fixtures/audio-player.html');

  await expect(page.getByRole('status')).toHaveText('Chưa có audio');
  await expect(page.getByRole('button', { name: 'Phát' })).toBeDisabled();
  await expect(page.locator('audio')).toHaveCount(1);
});

test('plays, pauses, and resumes the local audio source', async ({ page }) => {
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-source').click();

  const audio = page.locator('audio');
  await expect(page.getByRole('status')).toHaveText('Sẵn sàng phát');
  await expect(audio).toHaveJSProperty('paused', true);

  await page.getByRole('button', { name: 'Phát' }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => !element.paused)).toBe(true);
  await expect(page.getByRole('status')).toHaveText('Đang phát');
  const firstPosition = await audio.evaluate((element: HTMLAudioElement) => element.currentTime);
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(firstPosition);

  await page.getByRole('button', { name: 'Tạm dừng' }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await expect(page.getByRole('status')).toHaveText('Đã tạm dừng');
  const pausedPosition = await audio.evaluate((element: HTMLAudioElement) => element.currentTime);

  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => !element.paused)).toBe(true);
  await expect(page.getByRole('button', { name: 'Tạm dừng' })).toBeVisible();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(pausedPosition);
});

test('reports media errors and allows a deliberate retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/audio-error.wav', async (route) => {
    attempts += 1;
    await route.fulfill(attempts === 1
      ? { status: 404, contentType: 'text/plain', body: 'missing audio' }
      : { status: 200, contentType: 'audio/wav', body: createWavFixture() });
  });
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-error-source').click();
  await page.getByRole('button', { name: 'Phát' }).click();

  await expect(page.getByRole('alert')).toHaveText('Không phát được audio. Vui lòng thử lại.');
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => !element.paused)).toBe(true);
  expect(attempts).toBe(2);
});

test('does not report playing when play is rejected', async ({ page }) => {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.dataset.rejectPlay === 'true') return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      return originalPlay.call(this);
    };
  });
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-source').click();
  await page.locator('audio').evaluate((element) => { element.dataset.rejectPlay = 'true'; });
  await page.getByRole('button', { name: 'Phát' }).click();

  await expect(page.getByRole('alert')).toHaveText('Không phát được audio. Vui lòng thử lại.');
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tạm dừng' })).toHaveCount(0);
});

test('shows ended state and can replay from the beginning', async ({ page }) => {
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-source').click();
  const audio = page.locator('audio');
  await page.getByRole('button', { name: 'Phát' }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => !element.paused)).toBe(true);
  await audio.evaluate((element: HTMLAudioElement) => { element.currentTime = Math.max(0, element.duration - 0.05); });

  await expect(page.getByRole('status')).toHaveText('Đã phát xong', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Phát' }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => !element.paused)).toBe(true);
  await expect(page.getByRole('status')).toHaveText('Đang phát');
});

test('stops and detaches the old audio when the source changes', async ({ page }) => {
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-source').click();
  const oldAudio = await page.locator('audio').elementHandle();
  await page.getByRole('button', { name: 'Phát' }).click();
  await expect.poll(() => oldAudio!.evaluate((element: HTMLAudioElement) => !element.paused)).toBe(true);

  await page.getByTestId('load-second-source').click();
  await expect.poll(() => oldAudio!.evaluate((element: HTMLAudioElement) => ({
    paused: element.paused,
    source: element.getAttribute('src'),
  }))).toEqual({ paused: true, source: null });
  await expect(page.locator('audio')).toHaveAttribute('src', '/audio-fixture-2.wav');
  await expect(page.getByRole('status')).toHaveText('Sẵn sàng phát');
});

test('stops and detaches audio when the player unmounts', async ({ page }) => {
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-source').click();
  const audio = await page.locator('audio').elementHandle();
  await page.getByRole('button', { name: 'Phát' }).click();
  await expect.poll(() => audio!.evaluate((element: HTMLAudioElement) => !element.paused)).toBe(true);

  await page.getByTestId('unmount-player').click();
  await expect.poll(() => audio!.evaluate((element: HTMLAudioElement) => ({
    paused: element.paused,
    source: element.getAttribute('src'),
  }))).toEqual({ paused: true, source: null });
  await expect(page.locator('audio')).toHaveCount(0);
});

test('does not let an old pending play request update the replacement source', async ({ page }) => {
  await page.addInitScript(() => {
    let rejectPlay: (() => void) | undefined;
    Reflect.set(window, '__rejectAudioPlay', () => rejectPlay?.());
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.dataset.pendingPlay === 'true') {
        return new Promise<void>((_, reject) => { rejectPlay = () => reject(new DOMException('stale', 'AbortError')); });
      }
      return originalPlay.call(this);
    };
  });
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-source').click();
  await page.locator('audio').evaluate((element) => { element.dataset.pendingPlay = 'true'; });
  await page.getByRole('button', { name: 'Phát' }).click();
  await page.getByTestId('load-second-source').click();
  await page.evaluate(() => (Reflect.get(window, '__rejectAudioPlay') as () => void)());

  await expect(page.getByRole('status')).toHaveText('Sẵn sàng phát');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
