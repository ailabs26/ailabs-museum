import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';
import { installRendererProbe, waitForRendererIdle } from './fixtures/museumProbe';
import { roomDetailSchema } from '../src/validations/roomSchema';

test.setTimeout(120_000);
const controls = (page: Page) => page.locator('section[data-exhibit][data-phase]');
const cameraPosition = (page: Page) => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.toArray());
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((value, axis) => value - b[axis]));

async function openRoom(page: Page, locale: string, options: { reduced?: boolean; cms?: Record<string, string>; cmsError?: boolean } = {}) {
  await installMuseumApi(page);
  await installRendererProbe(page);
  await page.addInitScript(value => localStorage.setItem('aura:visitor:locale:v1', JSON.stringify({ version: 1, value })), locale);
  await page.route('**/api/public/translations**', route => fulfillMuseum(route,
    options.cmsError ? { success: false, data: null, message: 'Unavailable' } : envelope(options.cms ?? {}), options.cmsError ? 500 : 200));
  const localizedRoom = roomDetailSchema.parse({ ...roomA,
    i18n: { vi: { name: roomA.name, description: roomA.description }, en: { name: 'Translated gallery', description: 'Translated room' } },
    exhibits: roomA.exhibits.map(exhibit => ({ ...exhibit, i18n: {
      vi: { name: exhibit.name, description: exhibit.description, transcript: null },
      en: { name: `Translated ${exhibit.name}`, description: 'Translated description', transcript: null },
    } })),
  });
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope(localizedRoom)));
  await page.emulateMedia({ reducedMotion: options.reduced === false ? 'no-preference' : 'reduce' });
  await page.goto('/tour.html?room=sculpture');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  const opener = page.getByRole('button', { name: 'Mở phòng 3D', exact: true });
  await expect(opener).toBeVisible({ timeout: 15_000 });
  await opener.click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
}

const copies = [
  { locale: 'vi', label: 'Tham quan có hướng dẫn', start: 'Bắt đầu tham quan có hướng dẫn', pause: 'Tạm dừng', resume: 'Tiếp tục',
    previous: 'Hiện vật trước', next: 'Hiện vật tiếp theo', exit: 'Thoát hướng dẫn', viewing: 'Đang xem', paused: 'Đã tạm dừng', completed: 'Hoàn thành', exhibits: 'hiện vật' },
  { locale: 'en', label: 'Guided tour', start: 'Start guided tour', pause: 'Pause', resume: 'Resume',
    previous: 'Previous exhibit', next: 'Next exhibit', exit: 'Exit guided tour', viewing: 'Viewing', paused: 'Paused', completed: 'Completed', exhibits: 'exhibits' },
  { locale: 'fr', label: 'Visite guidée', start: 'Commencer la visite guidée', pause: 'Mettre en pause', resume: 'Reprendre',
    previous: 'Objet précédent', next: 'Objet suivant', exit: 'Quitter la visite guidée', viewing: 'Observation en cours', paused: 'En pause', completed: 'Visite terminée', exhibits: 'objets' },
  { locale: 'zh', label: '导览', start: '开始导览', pause: '暂停', resume: '继续',
    previous: '上一件展品', next: '下一件展品', exit: '退出导览', viewing: '正在观赏', paused: '已暂停', completed: '参观完成', exhibits: '件展品' },
  { locale: 'ko', label: '가이드 투어', start: '가이드 투어 시작', pause: '일시 정지', resume: '계속',
    previous: '이전 전시물', next: '다음 전시물', exit: '가이드 투어 종료', viewing: '관람 중', paused: '일시 정지됨', completed: '관람 완료', exhibits: '전시물' },
  { locale: 'ja', label: 'ガイドツアー', start: 'ガイドツアーを開始', pause: '一時停止', resume: '再開',
    previous: '前の展示物', next: '次の展示物', exit: 'ガイドツアーを終了', viewing: '鑑賞中', paused: '一時停止中', completed: '見学完了', exhibits: '展示物' },
];

for (const copy of copies) test(`guided controls use ${copy.locale} fallback when CMS has no keys`, async ({ page }) => {
  await openRoom(page, copy.locale);
  const bar = controls(page);
  await expect(bar).toHaveAccessibleName(copy.label);
  await bar.getByRole('button', { name: copy.start, exact: true }).click();
  await expect(bar).toHaveAttribute('data-phase', 'viewing');
  await expect(bar).toContainText(`1/5 ${copy.exhibits} · ${copy.viewing}`);
  await bar.getByRole('button', { name: copy.pause, exact: true }).click();
  await expect(bar).toContainText(copy.paused);
  await bar.getByRole('button', { name: copy.resume, exact: true }).click();
  await expect(bar).toHaveAttribute('data-phase', 'viewing');
  await bar.getByRole('button', { name: copy.next, exact: true }).click();
  await expect(bar).toHaveAttribute('data-exhibit', roomA.exhibits[1].id);
  await bar.getByRole('button', { name: copy.previous, exact: true }).click();
  await expect(bar).toHaveAttribute('data-exhibit', roomA.exhibits[0].id);
  for (let i = 1; i <= 5; i++) {
    await bar.getByRole('button', { name: copy.next, exact: true }).click();
    await expect(bar).toHaveAttribute('data-status', i === 5 ? 'completed' : 'running');
  }
  await expect(bar).toContainText(copy.completed);
  await bar.getByRole('button', { name: copy.exit, exact: true }).click();
  await expect(bar).toHaveAttribute('data-status', 'idle');
});

test('CMS guided copy overrides the bundled locale fallback', async ({ page }) => {
  await openRoom(page, 'en', { cms: { 'ui.guided.start': 'Start curated tour' } });
  await expect(controls(page)).toHaveAccessibleName('Guided tour');
  await controls(page).getByRole('button', { name: 'Start curated tour', exact: true }).click();
  await expect(controls(page)).toContainText('Viewing');
});

test('guided locale fallback remains available when CMS translations fail', async ({ page }) => {
  await openRoom(page, 'fr', { cmsError: true });
  await controls(page).getByRole('button', { name: 'Commencer la visite guidée', exact: true }).click();
  await expect(controls(page)).toContainText('Observation en cours');
});

test('locale-only updates preserve in-flight camera velocity and update exhibit copy', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 }));
  // Install before the renderer schedules RAF so every frame uses the same clock.
  const clockStart = new Date('2026-11-09T00:00:00Z');
  await page.clock.install({ time: clockStart });
  await openRoom(page, 'vi', { reduced: false });
  await waitForRendererIdle(page);
  await page.clock.pauseAt(new Date('2026-11-09T00:01:00Z'));
  await controls(page).getByRole('button', { name: 'Bắt đầu tham quan có hướng dẫn', exact: true }).evaluate(button => button.click());
  await expect(page.locator('[data-navigation-mode]')).toHaveAttribute('data-navigation-mode', 'focusing');
  await page.clock.runFor(1500);
  const before = await cameraPosition(page);
  await page.clock.runFor(100);
  const atChange = await cameraPosition(page);
  expect(distance(before, atChange)).toBeGreaterThan(0.02);
  await page.evaluate(() => {
    const key = 'aura:visitor:locale:v1';
    const newValue = JSON.stringify({ version: 1, value: 'en' });
    localStorage.setItem(key, newValue);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(controls(page).locator('strong')).toHaveText('Translated Hiện vật 1');
  await page.clock.runFor(100);
  const after = await cameraPosition(page);
  expect(distance(atChange, after)).toBeGreaterThan(distance(before, atChange) * 0.7);
  await expect(controls(page)).toHaveAttribute('data-phase', 'moving');
});
