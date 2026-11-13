import { expect, test } from '@playwright/test';
import { createWavFixture, fulfillSeekableAudio } from './fixtures/audioFixture';

test.beforeEach(async ({ page }) => {
  await page.route('**/audio-fixture.wav', route => fulfillSeekableAudio(route, createWavFixture()));
});

test('player hierarchy keeps title and status above timeline with compact adjacent controls', async ({ page }) => {
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-source').click();
  const region = page.getByRole('region', { name: 'Bản thuyết minh mẫu', exact: true });
  const title = await region.getByText('Bản thuyết minh mẫu', { exact: true }).boundingBox();
  const status = await region.getByRole('status').boundingBox();
  const seek = await region.getByRole('slider', { name: 'Tua âm thanh' }).boundingBox();
  const play = await region.getByRole('button', { name: 'Phát', exact: true }).boundingBox();
  const stop = await region.getByRole('button', { name: 'Dừng', exact: true }).boundingBox();
  const volume = await region.getByRole('slider', { name: 'Âm lượng' }).boundingBox();
  expect(title!.y + title!.height).toBeLessThanOrEqual(seek!.y);
  expect(status!.y + status!.height).toBeLessThanOrEqual(seek!.y);
  expect(play!.y).toBeGreaterThan(seek!.y);
  expect(Math.abs(play!.y - stop!.y)).toBeLessThan(2);
  expect(stop!.x - play!.x - play!.width).toBeLessThanOrEqual(12);
  expect(volume!.width).toBeGreaterThanOrEqual(100);
  expect(volume!.width).toBeLessThanOrEqual(140);
  for (const box of [play, stop, seek, volume]) expect(box!.height).toBeGreaterThanOrEqual(44);
});

test('paused seeking updates WebVTT without autoplay or empty caption space', async ({ page }) => {
  await page.route('**/guide.vtt', route => route.fulfill({ contentType: 'text/vtt', body: 'WEBVTT\n\n00:00.000 --> 00:02.000\nCue một\n\n00:02.000 --> 00:04.000\nCue hai\n' }));
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('load-caption-source').click();
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveCount(0);
  await expect(page.getByText('Phụ đề WebVTT', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Đang phát');
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveText('Cue một');
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await page.getByRole('slider', { name: 'Tua âm thanh' }).fill('3');
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveText('Cue hai');
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
  await page.getByRole('slider', { name: 'Tua âm thanh' }).fill('5');
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dừng', exact: true }).click();
  await expect(page.locator('audio')).toHaveJSProperty('seeking', false);
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveCount(0);
  await page.getByRole('slider', { name: 'Tua âm thanh' }).fill('3');
  await expect(page.getByLabel('Phụ đề hiện tại')).toHaveText('Cue hai');
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
});

test('player reflows in narrow containers and actual light and dark themes with accessible sliders', async ({ page }) => {
  await page.goto('/tests/fixtures/audio-player.html');
  await page.getByTestId('long-label').click();
  await page.getByTestId('load-source').click();
  const region = page.getByRole('region');
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', scheme);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const name of ['Tua âm thanh', 'Âm lượng']) {
        const box = await region.getByRole('slider', { name }).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
    }
    await region.evaluate(el => { el.style.width = '280px'; });
    expect(await region.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await region.evaluate(el => { el.style.width = ''; });
  }
  await region.getByRole('slider', { name: 'Âm lượng' }).focus();
  await expect(region.getByRole('slider', { name: 'Âm lượng' })).toBeFocused();
  expect(await page.getByLabel('Thời gian hiện tại').evaluate(el => el.closest('[aria-live]') === null)).toBe(true);
  await expect(region.getByRole('status')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('player-desktop-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: test.info().outputPath('player-mobile-light.png'), fullPage: true });
});
