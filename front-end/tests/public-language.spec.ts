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
    'ui.tour.open': 'Open 3D gallery',
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
    'ui.collection.eyebrow': 'Aura Museum / Discover exhibits',
    'ui.collection.intro': 'Take a moment with each story. Explore exhibits in a 2D interface without entering the 3D space.',
    'ui.collection.search': 'Search exhibits by name or keyword…',
    'ui.collection.rooms.label': 'Choose a gallery',
    'ui.collection.rooms.unavailable': 'Selected gallery is unavailable',
    'ui.collection.search.aria': 'Search exhibits',
    'ui.collection.favorites.only': 'Show only favorites in this gallery',
    'ui.collection.error.rooms': 'Could not load galleries',
    'ui.collection.empty.rooms': 'No public galleries yet.',
    'ui.collection.error.room-unavailable': 'This gallery is not public. Choose another gallery.',
    'ui.collection.error.exhibits': 'Could not load exhibits',
    'ui.collection.count.filtered': '{matched}/{total} exhibits match search',
    'ui.collection.count.published': '{count} published exhibits',
    'ui.collection.tour.room': 'Visit this gallery in 3D',
    'ui.collection.loading.updated': 'Updating exhibits…',
    'ui.collection.empty.exhibits': 'This gallery has no published exhibits yet.',
    'ui.collection.empty.favorites-search': 'No favorite exhibits match in this gallery. Favorite an exhibit or change your search.',
    'ui.collection.empty.search': 'No exhibits match “{query}”.',
    'ui.collection.exhibits.aria': 'Exhibits in this collection',
    'ui.collection.exhibit.badge': 'Exhibit {number}',
    'ui.collection.exhibit.preview': 'Exhibit preview',
    'ui.collection.exhibit.image-missing': 'No image',
    'ui.collection.details.aria': 'View details {name}',
    'ui.collection.report': 'Report content',
    'ui.collection.compare.action': 'Compare',
    'ui.collection.compare.aria': 'Compare {name}',
    'ui.action.retry': 'Try again',
    'ui.collection.other-rooms': 'In other galleries',
    'ui.collection.search.loading': 'Searching the museum…',
    'ui.collection.search.error': 'Could not search other galleries',
    'ui.collection.search.empty': 'No exhibits match “{query}” in other galleries.',
    'ui.collection.search.count.one': 'Found {count} exhibit in other galleries',
    'ui.collection.search.count.many': 'Found {count} exhibits in other galleries',
    'ui.collection.search.results.aria': 'Results in other galleries',
    'ui.collection.search.more': 'Show more results',
    'ui.visitor.storage.unavailable': 'This browser cannot save changes. They may be lost when you reload.',
    'ui.visitor.storage.limit': 'Storage is full. Remove an item before adding another.',
    'ui.visitor.storage.invalid': 'Saved data is invalid or from another version. Using defaults.',
    'ui.visitor.favorite.add': 'Add to favorites',
    'ui.visitor.favorite.saved': 'Favorited',
    'ui.visitor.favorite.aria-add': 'Add {name} to favorites',
    'ui.visitor.favorite.aria-remove': 'Remove {name} from favorites',
    'ui.visitor.recent.title': 'Recently viewed',
    'ui.visitor.recent.clear': 'Clear history',
    'ui.visitor.recent.empty': 'No recently viewed exhibits yet.',
    'ui.visitor.recent.rooms-unavailable': 'The public gallery list could not be verified.',
    'ui.visitor.recent.loading': 'Checking recently viewed exhibits…',
    'ui.visitor.recent.continue': 'Continue exploring: {exhibit} — {room}',
    'ui.visitor.recent.missing': 'Some exhibits are no longer available or could not be verified.',
    'ui.visitor.recent.reload-help': 'Use Refresh to load public content again.',
    'ui.visitor.compare.title': 'Comparison selections',
    'ui.visitor.compare.instructions': 'Choose 2–3 exhibits, including exhibits from different galleries.',
    'ui.visitor.compare.status': 'Comparison status',
    'ui.visitor.compare.removing': 'Verifying exhibit',
    'ui.visitor.compare.missing': 'Exhibit unavailable',
    'ui.visitor.compare.remove.aria': 'Remove {name} from comparison',
    'ui.visitor.compare.remove': 'Remove',
    'ui.visitor.compare.load-error': 'Could not load some content. Use Refresh to try again.',
    'ui.visitor.compare.open': 'Open comparison ({count})',
    'ui.visitor.compare.clear': 'Clear comparison selection',
    'ui.visitor.compare.modal.title': 'Compare exhibits',
    'ui.visitor.compare.modal.close': 'Close comparison',
    'ui.visitor.compare.loading': 'Checking comparison content…',
    'ui.visitor.compare.insufficient': 'At least 2 public exhibits are needed to compare.',
    'ui.visitor.compare.region': 'Comparison content, scroll horizontally on small screens',
    'ui.visitor.compare.description': 'Description',
    'ui.visitor.compare.no-description': 'No description yet.',
    'ui.visitor.compare.message.removed': 'Removed from comparison.',
    'ui.visitor.compare.message.maximum': 'You can compare up to 3 exhibits. Remove one before adding another.',
    'ui.visitor.compare.message.added': 'Added to comparison.',
    'ui.visitor.compare.message.cleared': 'Comparison selection cleared.',
    'ui.visitor.reading.section': 'Exhibit reading preferences',
    'ui.visitor.reading.toggle': 'Reading mode',
    'ui.visitor.reading.decrease': 'Decrease text size',
    'ui.visitor.reading.size.aria': 'Reading text size',
    'ui.visitor.reading.size': 'Text size {percent}%',
    'ui.visitor.reading.increase': 'Increase text size',
    'ui.visitor.reading.reset': 'Reset reading preferences',
    'ui.visitor.notes.section': 'Private notes',
    'ui.visitor.notes.label': 'Your note',
    'ui.visitor.notes.description': 'Notes are stored only in this browser',
    'ui.visitor.notes.count': '{count}/2000 characters · Saved automatically as you type.',
    'ui.visitor.notes.full': 'You have 100 notes. Delete a note from another exhibit before creating a new one.',
    'ui.visitor.notes.status.aria': 'Note status',
    'ui.visitor.notes.saved': 'Note saved in this browser.',
    'ui.visitor.notes.empty': 'No note yet.',
    'ui.visitor.notes.unsaved': 'Note is not saved in this browser.',
    'ui.visitor.notes.clear': 'Delete note',
    'ui.visitor.notes.retry': 'Try saving note again',
    'ui.detail.back': 'Back to this gallery’s collection',
    'ui.detail.tour': 'View in 3D space',
    'ui.detail.report': 'Report content',
    'ui.detail.error.invalid.title': 'Invalid exhibit URL',
    'ui.detail.error.invalid.message': 'The exhibit ID in the URL is not valid.',
    'ui.detail.loading.title': 'Exhibit details',
    'ui.detail.loading.rooms': 'Loading galleries…',
    'ui.detail.loading.exhibit': 'Loading exhibit…',
    'ui.detail.error.load': 'Could not load content',
    'ui.detail.error.room.title': 'Gallery not found',
    'ui.detail.error.room.message': 'The gallery in this URL is not public.',
    'ui.detail.error.exhibit.title': 'Exhibit not found',
    'ui.detail.error.exhibit.message': 'This exhibit is not in the gallery’s public collection.',
    'ui.detail.back-to-collection': 'Back to collection',
    'ui.detail.section.story': 'Exhibit story',
    'ui.tour.catalogue.select.aria': 'View details for {name}',
    'ui.tour.panel.label': 'Exhibit details',
    'ui.detail.description.empty': 'No description available.',
    'ui.detail.section.transcript': 'Narration transcript',
    'ui.detail.section.hotspots': 'Points of interest',
    'ui.detail.section.hotspots.aria': 'Points of interest for this exhibit',
    'ui.detail.section.credits': 'Sources & copyright',
    'ui.report.title': 'Report content',
    'ui.report.close': 'Close report form',
    'ui.report.category': 'Category',
    'ui.report.category.placeholder': 'Select a category',
    'ui.report.category.wrong_info': 'Incorrect information',
    'ui.report.category.typo': 'Typo',
    'ui.report.category.inappropriate_content': 'Inappropriate image/content',
    'ui.report.category.other': 'Other',
    'ui.report.message': 'Additional details',
    'ui.report.validation.message-required': 'Please enter report details.',
    'ui.report.validation.message-too-long': 'Report details must not exceed 2000 characters.',
    'ui.report.validation.category-required': 'Select a report category.',
    'ui.media.credit.author': 'Author',
    'ui.media.credit.source': 'Source',
    'ui.media.credit.license': 'License',
    'ui.media.type.model': '3D model',
    'ui.media.type.image': 'Image',
    'ui.media.type.narration.vi': 'Vietnamese narration',
    'ui.media.type.narration.en': 'English narration',
    'ui.media.type.subtitle.vi': 'Vietnamese subtitles',
    'ui.media.type.subtitle.en': 'English subtitles',
    'ui.report.cancel': 'Cancel',
    'ui.report.submit': 'Submit report',
    'ui.report.success': 'Report submitted',
    'ui.audio.label': 'Audio narration',
    'ui.audio.status.empty': 'No audio available',
    'ui.audio.status.ready': 'Ready to play',
    'ui.audio.status.loading': 'Loading audio…',
    'ui.audio.status.playing': 'Playing',
    'ui.audio.status.paused': 'Paused',
    'ui.audio.status.ended': 'Playback complete',
    'ui.audio.status.error': 'Could not play audio. Please try again.',
    'ui.audio.play': 'Play',
    'ui.audio.pause': 'Pause',
    'ui.audio.resume': 'Resume',
    'ui.audio.retry': 'Try again',
    'ui.audio.stop': 'Stop',
    'ui.audio.seek.aria': 'Seek audio',
    'ui.audio.volume.aria': 'Volume',
    'ui.audio.time.current.aria': 'Current time',
    'ui.audio.time.total.aria': 'Total duration',
    'ui.audio.captions.title': 'WebVTT subtitles',
    'ui.audio.captions.enable': 'Turn subtitles on',
    'ui.audio.captions.disable': 'Turn subtitles off',
    'ui.audio.captions.error': 'Could not load subtitles. You can still read the transcript.',
    'ui.audio.captions.current.aria': 'Current subtitles',
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

test('slow translation response keeps Vietnamese fallback until English strings arrive', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('**/api/public/translations**', async (route) => {
    const locale = new URL(route.request().url()).searchParams.get('locale') ?? '';
    await new Promise((resolve) => setTimeout(resolve, 500));
    await fulfillMuseum(route, envelope(STRINGS[locale] ?? {}));
  });
  await page.goto('/collection');

  await language(page).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', level: 1 })).toBeVisible();
  await expect(page.getByText('ui.collection.title')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Our Collection', level: 1 })).toBeVisible();
});

test('public language journey keeps translations from Home through Tour and falls back safely', async ({ page }) => {
  await install(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chạm vào Di sản. Khám phá Không giới hạn.', level: 1 })).toBeVisible();

  await language(page).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Touch Heritage. Explore without limits.', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Browse the collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Our Collection', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'View details Bronze statue' }).first().click();
  await expect(page.getByRole('heading', { name: 'Bronze statue', level: 1 })).toBeVisible();
  await expect(page.getByText('Exhibit preview')).toBeVisible();
  await expect(page.getByText('No image', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: '3D Tour' }).click();
  await expect(page.getByRole('button', { name: 'Open 3D gallery' })).toBeVisible();
  await expect(page.getByText('Exhibit preview').first()).toBeVisible();
  await page.getByRole('button', { name: 'View details for Hiện vật 1' }).click();
  const tourDetails = page.getByRole('complementary', { name: 'Exhibit details' });
  await expect(tourDetails.getByText('Exhibit preview')).toBeVisible();
  await expect(tourDetails.getByRole('region', { name: 'Audio narration' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  for (const locale of ['ja', 'fr', 'zh']) {
    await language(page).selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('link', { name: locale === 'ja' ? 'コレクション' : 'Bộ sưu tập' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/ui\.[\w.-]+/);
  }
  await language(page).selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('media credit labels follow English while attribution values stay unchanged', async ({ page }) => {
  const { first } = await install(page);
  const checksum = 'a'.repeat(64);
  const rights = { author: 'Curator A', source: 'Museum archive', license: 'CC0' };
  const media = (index: number) => ({
    id: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    url: `http://127.0.0.1:4173/media-${index}`,
    mimeType: 'audio/mpeg', sizeBytes: 128, rights,
  });
  const withMedia = {
    ...first,
    model: {
      id: '30000000-0000-4000-8000-000000000001', storageKey: 'models/example.glb', sizeBytes: 1024,
      checksumSha256: checksum, url: `/rooms/sculpture/exhibits/${first.id}/model?version=${checksum}`, rights,
    },
    image: { ...media(2), altText: { vi: null, en: null } },
    audio: {
      vi: { audio: media(3), subtitle: media(4), transcript: null },
      en: { audio: media(5), subtitle: media(6), transcript: null },
    },
  };
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits: [withMedia, ...roomA.exhibits.slice(1)] })));
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await language(page).selectOption('en');

  const credits = page.locator('ul').filter({ hasText: 'Museum archive' });
  for (const label of ['3D model:', 'Image:', 'Vietnamese narration:', 'Vietnamese subtitles:', 'English narration:', 'English subtitles:']) {
    await expect(credits.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(credits).toContainText('Author: Curator A');
  await expect(credits).toContainText('Source: Museum archive');
  await expect(credits).toContainText('License: CC0');
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
  await expect(page.getByRole('link', { name: 'Back to this gallery’s collection' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View in 3D space' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report content' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exhibit story', level: 2 })).toBeVisible();
  const audio = page.getByRole('region', { name: 'Audio narration' });
  await expect(audio.getByRole('status')).toHaveText('No audio available');
  await expect(audio.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await expect(audio.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
  await expect(audio.getByRole('slider', { name: 'Seek audio' })).toBeDisabled();
  await expect(audio.getByRole('slider', { name: 'Volume' })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Exhibit reading preferences' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reading mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Reading mode' }).click();
  await expect(page.getByRole('button', { name: 'Decrease text size' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Reading text size' })).toHaveText('Text size 100%');
  await expect(page.getByRole('button', { name: 'Increase text size' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset reading preferences' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Private notes' })).toBeVisible();
  const note = page.getByRole('textbox', { name: 'Your note' });
  await expect(note).toBeVisible();
  await expect(page.getByRole('status', { name: 'Note status' })).toHaveText('No note yet.');
  await note.fill('Museum');
  await expect(page.getByText('6/2000 characters · Saved automatically as you type.')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Note status' })).toHaveText('Note saved in this browser.');
  await page.getByRole('button', { name: 'Delete note' }).click();
  await expect(page.getByRole('status', { name: 'Note status' })).toHaveText('No note yet.');
});

test('report labels follow the locale while preserving the submitted category and revision', async ({ page }) => {
  const { first } = await install(page);
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/public/reports', async route => {
    payload = route.request().postDataJSON();
    await fulfillMuseum(route, envelope({ id: 'c1111111-1111-4111-8111-111111111111', status: 'open' }), 201);
  });
  await page.goto('/collection');
  await language(page).selectOption('en');
  await page.getByRole('link', { name: 'View details Bronze statue' }).click();
  await page.getByRole('button', { name: 'Report content' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Report content' })).toBeVisible();
  const category = dialog.getByLabel('Category');
  await category.selectOption('wrong_info');
  await expect(category.locator('option:checked')).toHaveText('Incorrect information');
  const message = dialog.getByLabel('Additional details');
  await message.fill('   ');
  await dialog.getByRole('button', { name: 'Submit report' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please enter report details.');
  await message.fill('  Check the date  ');

  await language(page).selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(dialog.getByRole('heading', { name: 'Báo cáo nội dung' })).toBeVisible();
  await expect(dialog.getByLabel('Danh mục')).toHaveValue('wrong_info');
  await expect(dialog.getByLabel('Danh mục').locator('option:checked')).toHaveText('Sai thông tin');
  await expect(dialog.getByLabel('Nội dung bổ sung')).toHaveValue('  Check the date  ');
  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await expect(dialog).toHaveCount(0);
  expect(payload).toEqual({ exhibitId: first.id, reportedRevisionId: first.revisionId, category: 'wrong_info', message: 'Check the date' });
  await expect(page.getByText('Đã gửi báo cáo nội dung')).toBeVisible();
});

test('Collection search, cards and visitor actions use the selected language', async ({ page }) => {
  test.setTimeout(60_000);
  await install(page);
  await page.goto('/collection');
  await language(page).selectOption('en');

  const rooms = page.getByRole('group', { name: 'Choose a gallery' });
  await expect(rooms.getByRole('button', { name: roomA.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Take a moment with each story. Explore exhibits in a 2D interface without entering the 3D space.')).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Search exhibits' });
  await expect(search).toHaveAttribute('placeholder', 'Search exhibits by name or keyword…');
  const cards = page.getByRole('list', { name: 'Exhibits in this collection' }).getByRole('listitem');
  await expect(cards).toHaveCount(5);
  await expect(page.getByText('No image', { exact: true })).toHaveCount(5);
  await expect(page.getByText('5 published exhibits')).toBeVisible();
  const first = cards.first();
  await expect(first.getByText('Exhibit 01')).toBeVisible();
  await expect(first.getByRole('link', { name: 'View details Bronze statue' })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Report content' })).toBeVisible();

  const favorite = first.getByRole('button', { name: 'Add Bronze statue to favorites' });
  await favorite.click();
  await expect(first.getByRole('button', { name: 'Remove Bronze statue from favorites' })).toHaveAttribute('aria-pressed', 'true');
  await expect(first.getByRole('button', { name: 'Remove Bronze statue from favorites' })).toHaveText('Favorited');
  const onlyFavorites = page.getByRole('checkbox', { name: 'Show only favorites in this gallery' });
  await onlyFavorites.check();
  await expect(cards).toHaveCount(1);
  await onlyFavorites.uncheck();
  await expect(cards).toHaveCount(5);

  const compare = first.getByRole('button', { name: 'Compare Bronze statue' });
  await compare.click();
  await expect(page.getByRole('status', { name: 'Comparison status' })).toHaveText('Added to comparison.');
  await cards.nth(1).getByRole('button', { name: /^Compare / }).click();
  await expect(page.getByRole('button', { name: 'Open comparison (2)' })).toBeEnabled();
  await page.getByRole('button', { name: 'Open comparison (2)' }).click();
  const comparison = page.getByRole('dialog', { name: 'Compare exhibits' });
  await expect(comparison.getByRole('heading', { name: 'Description', level: 4 })).toHaveCount(2);
  await expect(comparison.getByText('English description')).toBeVisible();
  await expect(comparison.getByText('No image', { exact: true })).toHaveCount(2);
  await comparison.getByRole('button', { name: 'Close comparison' }).click();

  await search.fill('$&');
  await expect(page.getByRole('status').filter({ hasText: 'No exhibits match “$&”.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'No exhibits match “$&” in other galleries.' })).toBeVisible();
  await expect(page.getByText('0/5 exhibits match search')).toBeVisible();
});

test('Recently viewed content uses the selected exhibit language', async ({ page }) => {
  const { first } = await install(page);
  await page.goto('/collection');
  await language(page).selectOption('en');
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await expect(page.getByRole('heading', { name: 'Bronze statue', level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('aura:visitor:recent:v1'))).toContain(first.id);
  await page.goto('/collection');
  await expect(page.getByRole('link', { name: `Continue exploring: Bronze statue — ${roomA.name}` })).toBeVisible();
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
  await page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', JSON.stringify({ version: 1, value: 'en' })));
  const englishTranslations = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/public/translations') && url.searchParams.get('locale') === 'en';
  });
  await page.goto('/');
  await englishTranslations;
  await expect(page.getByRole('heading', { name: 'Touch Heritage. Explore without limits.', level: 1 })).toBeVisible({ timeout: 15_000 });
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
