import { expect, test } from '@playwright/test';
import { createWavFixture } from './fixtures/audioFixture';

test.beforeEach(async ({ page }) => {
  await page.route('**/audio-fixture.wav', async (route) => {
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: createWavFixture() });
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
