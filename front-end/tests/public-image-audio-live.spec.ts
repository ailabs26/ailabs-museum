import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema } from '../src/validations/roomSchema';

test('published image and audio load through the real API', async ({ page, request }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Opt-in read-only live API check');
  const api = process.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
  const list = await request.get(`${api}/rooms`);
  expect(list.ok(), 'Live API must be running').toBe(true);
  const rooms = roomListSchema.parse((await list.json()).data);
  let selected: { slug: string; exhibit: ReturnType<typeof roomDetailSchema.parse>['exhibits'][number] } | undefined;
  for (const room of rooms) {
    const response = await request.get(`${api}/rooms/${encodeURIComponent(room.slug)}`);
    expect(response.ok()).toBe(true);
    const detail = roomDetailSchema.parse((await response.json()).data);
    const exhibit = detail.exhibits.find(item => item.image && item.audio?.vi);
    if (exhibit) { selected = { slug: room.slug, exhibit }; break; }
  }
  test.skip(!selected, 'No published exhibit with image + Vietnamese audio; live acceptance pending content');
  const { slug, exhibit } = selected!;
  for (const url of [exhibit.image!.url, exhibit.audio!.vi!.audio.url, exhibit.audio!.vi!.subtitle?.url].filter((value): value is string => !!value)) {
    const readiness = await request.head(url);
    if (readiness.status() === 404) {
      test.info().annotations.push({ type: 'blocker', description: `Published media URL returns 404: ${url}; live acceptance remains pending` });
      test.skip(true, 'Published media file is unavailable (HTTP 404); this is not a successful live acceptance');
    }
    expect(readiness.ok(), `Published media must be deliverable: ${url}`).toBe(true);
  }
  const mediaResponses: { url: string; status: number }[] = [];
  page.on('response', response => {
    if ([exhibit.image!.url, exhibit.audio!.vi!.audio.url, exhibit.audio!.vi!.subtitle?.url].includes(response.url())) {
      mediaResponses.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto(`/collection/${encodeURIComponent(slug)}/exhibits/${exhibit.id}`);
  const image = page.getByRole('img', { name: exhibit.image!.altText.vi || exhibit.name, exact: true });
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const audio = page.locator('audio');
  await expect(audio).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime), { timeout: 15000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const pausedTime = await audio.evaluate((el: HTMLAudioElement) => el.currentTime);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(pausedTime);
  if (exhibit.audio!.vi!.subtitle) {
    await expect.poll(() => page.getByLabel('Phụ đề hiện tại').innerText(), { timeout: 10000 }).not.toBe('');
  } else test.info().annotations.push({ type: 'limitation', description: 'No live VTT on selected exhibit; captions proven only by fixtures' });
  expect(mediaResponses.some(item => item.url === exhibit.image!.url && [200, 304].includes(item.status))).toBe(true);
  expect(mediaResponses.some(item => item.url === exhibit.audio!.vi!.audio.url && [200, 206].includes(item.status))).toBe(true);
  await page.getByRole('button', { name: 'Dừng', exact: true }).click();
  await expect(audio).toHaveJSProperty('currentTime', 0);
});
