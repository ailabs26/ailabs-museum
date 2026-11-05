import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

/** Chuỗi UI từ CMS theo ngôn ngữ; `en` đủ, `ja` chỉ một phần để kiểm dự phòng. */
const STRINGS: Record<string, Record<string, string>> = {
  en: {
    'ui.brand.home-aria': 'Aura Museum — Home',
    'ui.skip-link': 'Skip to main content',
    'ui.nav.home': 'Home',
    'ui.nav.collection': 'Collection',
    'ui.nav.main': 'Main navigation',
    'ui.nav.open': 'Open navigation menu',
    'ui.nav.tour': '3D Tour',
    'ui.cta.enter-3d': 'Enter the 3D space',
    'ui.drawer.title': 'Navigation',
    'ui.theme.to-dark': 'Switch to dark theme',
    'ui.collection.title': 'Our Collection',
    'ui.collection.refresh': 'Refresh',
    'ui.language.label': 'Language',
    'ui.footer.accessibility': 'Accessibility commitment: WCAG 2.2 AA',
    'ui.footer.manifesto': 'Preserving heritage and retelling its stories in 3D WebXR so everyone, anywhere, can reach art and history.',
    'ui.footer.explore': 'Explore',
    'ui.footer.home': 'Home',
    'ui.footer.collection': '2D Collection',
    'ui.footer.tour': '3D WebXR Tour',
    'ui.footer.system': 'System',
    'ui.footer.admin': 'Administrator portal',
    'ui.footer.copyright': '© 2026 Aura Museum · Digital museum project · ailabs26 team',
    'ui.footer.design-credit': 'Designed with Aura Design System 2.0',
    'ui.home.hero.badge': 'The next-generation 3D WebXR museum',
    'ui.home.hero.title.primary': 'Touch Heritage.',
    'ui.home.hero.title.secondary': 'Explore without limits.',
    'ui.home.hero.introduction': 'Explore interactive 3D galleries and hear stories from history in your browser.',
    'ui.home.hero.cta.tour': 'Explore the 3D space',
    'ui.home.hero.cta.collection': 'Browse the collection',
    'ui.home.stats.rooms': 'Virtual galleries',
    'ui.home.stats.exploration': '3D & WebXR exploration',
    'ui.home.stats.audio': 'Audio guide & subtitles',
    'ui.home.stats.audio-value': 'Bilingual',
    'ui.home.stats.setup': 'No setup required',
    'ui.home.showcase.tag': 'Interactive 3D model',
    'ui.home.about.eyebrow': 'About Aura Museum',
    'ui.home.about.title.primary': 'Digital spaces.',
    'ui.home.about.title.secondary': 'Real connection.',
    'ui.home.about.webxr.title': 'Immersive WebXR virtual space',
    'ui.home.about.webxr.description': 'Walk through 3D exhibition rooms in your browser. Compatible with VR headsets (Quest, Pico, HTC Vive) and flexible WASD / touch controls.',
    'ui.home.about.audio.title': 'Audio guides with animated sound waves',
    'ui.home.about.audio.description': 'Audio player with bilingual WebVTT subtitles synchronized to every sentence.',
    'ui.home.about.heritage.title': 'High-detail heritage recreations',
    'ui.home.about.heritage.description': 'Explore ceramic and bronze patterns, materials, and smart annotations in detail.',
    'ui.home.about.accessibility.title': 'Accessible to everyone (WCAG 2.2 AA)',
    'ui.home.about.accessibility.description': 'Fully keyboard navigable, standards-compliant contrast, and a smooth 2D fallback when WebGL is unavailable.',
    'ui.home.featured.eyebrow': 'From the collection',
    'ui.home.featured.title': 'Featured exhibits',
    'ui.home.featured.loading-rooms': 'Loading galleries…',
    'ui.home.featured.rooms-error': 'Could not load galleries',
    'ui.home.featured.retry': 'Try again',
    'ui.home.featured.empty-rooms': 'No public galleries yet.',
    'ui.home.featured.loading-exhibits': 'Loading featured exhibits…',
    'ui.home.featured.exhibits-error': 'Could not load featured exhibits',
    'ui.home.featured.description': 'A selection of exhibits in display order',
    'ui.home.featured.empty-exhibits': 'This gallery has no published exhibits yet.',
    'ui.home.featured.room-collection': 'View this gallery’s collection',
  },
  ja: { 'ui.nav.collection': 'コレクション' },
};

async function install(page: Page) {
  await installMuseumApi(page);
  const requested: string[] = [];
  await page.route('**/api/public/translations**', (route) => {
    const locale = new URL(route.request().url()).searchParams.get('locale') ?? '';
    requested.push(locale);
    return fulfillMuseum(route, envelope(STRINGS[locale] ?? {}));
  });
  const first = { ...roomA.exhibits[0], i18n: {
    vi: { name: roomA.exhibits[0].name, description: roomA.exhibits[0].description, transcript: null },
    en: { name: 'Bronze statue', description: 'English description', transcript: null },
  } };
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [first, ...roomA.exhibits.slice(1)] })));
  return { requested, first };
}

const language = (page: Page) => page.getByRole('combobox', { name: /Ngôn ngữ|Language/ }).first();

test('mặc định tiếng Việt, không gọi API bản dịch; chọn English đổi giao diện, nội dung hiện vật và html lang', async ({ page }) => {
  const { requested } = await install(page);
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', level: 1 })).toBeVisible();
  expect(requested).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');

  await language(page).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Our Collection', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bronze statue', level: 3 })).toBeVisible();
  await expect(page.getByText('English description')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('chuỗi chưa dịch giữ tiếng Việt (không hiện khóa); API lỗi vẫn dùng được; lựa chọn còn sau khi tải lại', async ({ page }) => {
  await install(page);
  await page.goto('/collection');
  await language(page).selectOption('ja');
  await expect(page.getByRole('link', { name: 'コレクション' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', level: 1 })).toBeVisible();
  await expect(page.getByText('ui.collection.title')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(language(page)).toHaveValue('ja');

  await page.route('**/api/public/translations**', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Lỗi' }, 500));
  await language(page).selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', level: 1 })).toBeVisible();
});

test('trang chi tiết hiện vật theo ngôn ngữ đã chọn', async ({ page }) => {
  const { first } = await install(page);
  await page.goto('/collection');
  await language(page).selectOption('en');
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await expect(page.getByRole('heading', { name: 'Bronze statue', level: 1 })).toBeVisible();
  await expect(page.getByText('English description')).toBeVisible();
});

test('Home hero and featured section use the selected language', async ({ page }) => {
  const { requested } = await install(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chạm vào Di sản. Khám phá Không giới hạn.', level: 1 })).toBeVisible();
  expect(requested).toEqual([]);

  await language(page).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Touch Heritage. Explore without limits.', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse the collection', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeAttached();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: '3D Tour' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Aura Museum — Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enter the 3D space' })).toBeVisible();
  await expect(page.getByText('Virtual galleries')).toBeVisible();
  await expect(page.getByText('Bilingual', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Immersive WebXR virtual space' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Featured exhibits', level: 2 })).toBeVisible();
  await expect(page.getByText('A selection of exhibits in display order')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View this gallery’s collection' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Explore' })).toBeVisible();
  await expect(page.getByText('Preserving heritage and retelling its stories in 3D WebXR so everyone, anywhere, can reach art and history.')).toBeVisible();
  await expect(page.getByText('Accessibility commitment: WCAG 2.2 AA')).toBeVisible();
  expect(requested).toContain('en');
});

test('Home featured empty and error states are translated', async ({ page }) => {
  await install(page);
  let status = 200;
  let response = envelope([]);
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, response, status));
  await page.goto('/');
  await language(page).selectOption('en');
  await expect(page.getByRole('status').filter({ hasText: 'No public galleries yet.' })).toBeVisible();

  status = 500;
  response = { success: false, data: null, message: 'Server error' };
  await page.reload();
  await expect(page.getByRole('alert', { name: 'Could not load galleries' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('320px: không tràn ngang; ô ngôn ngữ nằm trong menu và vẫn đổi được', async ({ page }) => {
  await install(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chạm vào Di sản. Khám phá Không giới hạn.', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Navigation' })).toBeVisible();
});
