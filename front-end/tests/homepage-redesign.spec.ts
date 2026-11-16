import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, exhibit, roomA, roomC, roomSummaries } from './fixtures/museumContent';

const forbidden3dRequest = /HeroCanvas|MuseumScene\.tsx|ModelPreview\.tsx|react-three-fiber|@react-three\/fiber|three(?:\.|-|\/)|\.glb(?:\?|$)|draco_decoder/i;

for (const { webglEnabled, reducedMotion } of [
  { webglEnabled: true, reducedMotion: false },
  { webglEnabled: false, reducedMotion: false },
  { webglEnabled: true, reducedMotion: true },
]) {
  test(`homepage stays 2D with WebGL ${webglEnabled ? 'enabled' : 'disabled'} and reduced motion ${reducedMotion ? 'enabled' : 'disabled'}`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    if (!webglEnabled) {
      await page.addInitScript(() => Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: undefined }));
    }
    if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
    await installMuseumApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(reducedMotion);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Khám phá Không gian 3D (WebXR)' })).toHaveAttribute('href', '/tour');
    await expect(page.getByRole('link', { name: 'Xem Danh mục Bộ sưu tập' })).toHaveAttribute('href', '/collection');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(requests.filter((url) => forbidden3dRequest.test(url))).toEqual([]);
    await expect(page.getByText('5+', { exact: true })).toHaveCount(0);
    await expect(page.getByText('100%', { exact: true })).toHaveCount(0);
    await expect(page.getByText('0s', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Trống đồng Đông Sơn', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/~2\.500 năm/)).toHaveCount(0);
  });
}

test('homepage hero and shared navigation remain available when room API fails', async ({ page }) => {
  await page.route('**/api/rooms**', (route) => route.abort());
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const tourLink = page.getByRole('link', { name: 'Khám phá Không gian 3D (WebXR)' });
  await expect(tourLink).toHaveAttribute('href', '/tour');
  await expect(page.getByRole('link', { name: 'Xem Danh mục Bộ sưu tập' })).toHaveAttribute('href', '/collection');

  for (let index = 0; index < 12 && !(await tourLink.evaluate((link) => link === document.activeElement)); index += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(tourLink).toBeFocused();
  await expect(tourLink).toHaveCSS('outline-style', 'solid');
});

test('hero selects the first sorted exhibit with an image and keeps its localized name, alt, and detail link together', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await installMuseumApi(page);
  await page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', '{"version":1,"value":"en"}'));
  const withImage = (index: number, id: string, name: string, filename: string, altText: { vi: string; en: string }) => ({
    ...exhibit(index), id, displayOrder: 1, name,
    i18n: {
      vi: { name, description: `Mô tả ${name}`, transcript: null },
      en: { name: `English ${name}`, description: `Description for ${name}`, transcript: null },
    },
    image: {
      id: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      url: `https://museum.test/${filename}`, mimeType: 'image/svg+xml', sizeBytes: 120,
      rights: { source: null, author: null, license: null }, altText,
    },
  });
  const idFirst = '10000000-0000-4000-8000-000000000001';
  const idSecond = '10000000-0000-4000-8000-000000000002';
  const firstById = withImage(1, idFirst, 'Candidate by ID', 'first.svg', { vi: 'Ảnh tiếng Việt', en: 'Localized image alt' });
  const secondById = withImage(2, idSecond, 'Candidate by arrival order', 'second.svg', { vi: 'Ảnh thứ hai', en: 'Second image alt' });
  const noImage = { ...exhibit(3), displayOrder: 0 };
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [secondById, noImage, firstById] })));
  await page.route('https://museum.test/*.svg', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400"><circle cx="100" cy="200" r="80" fill="#c7a46e"/></svg>',
  }));
  await page.goto('/');

  const hero = page.locator('section[aria-labelledby="home-title"]');
  const heroImage = hero.getByRole('img', { name: 'Localized image alt' });
  await expect(heroImage).toBeVisible();
  await expect(heroImage).toHaveAttribute('loading', 'eager');
  await expect(heroImage).toHaveCSS('object-fit', 'contain');
  await expect.poll(() => heroImage.evaluate((image: HTMLImageElement) => image.naturalHeight / image.naturalWidth)).toBeGreaterThan(1);
  const heroLink = hero.getByRole('link', { name: /English Candidate by ID/ });
  await expect(heroLink).toHaveAttribute('href', `/collection/sculpture/exhibits/${idFirst}`);
  await expect(hero.getByRole('img', { name: 'Second image alt' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Hiện vật nổi bật' }).getByRole('img').first()).toHaveAttribute('loading', 'lazy');
  expect(requests.filter((url) => /\/(model|audio)\//i.test(url))).toEqual([]);
});

test('hero stays neutral when the first public room has no image or no exhibits', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([roomSummaries[0]])));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: roomA.exhibits.slice(0, 2) })));
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  await expect(hero.locator('img')).toHaveCount(0);
  await expect(hero.locator('a[href*="/exhibits/"]')).toHaveCount(0);

  await page.unroute('**/api/rooms/sculpture');
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([roomSummaries[2]])));
  await page.route('**/api/rooms/empty', (route) => fulfillMuseum(route, envelope(roomC)));
  await page.goto('/');
  await expect(hero.locator('img')).toHaveCount(0);
  await expect(hero.locator('a[href*="/exhibits/"]')).toHaveCount(0);
});

test('failed hero image uses its fallback without losing the real exhibit link', async ({ page }) => {
  await installMuseumApi(page);
  const imageExhibit = {
    ...exhibit(1), image: {
      id: '30000000-0000-4000-8000-000000000001', url: 'https://museum.test/fails.png', mimeType: 'image/png', sizeBytes: 68,
      rights: { source: null, author: null, license: null }, altText: { vi: 'Ảnh hiện vật', en: 'Exhibit image' },
    },
  };
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [imageExhibit] })));
  await page.route('https://museum.test/fails.png', (route) => fulfillMuseum(route, null, 404));
  await page.goto('/');

  const hero = page.locator('section[aria-labelledby="home-title"]');
  await expect(hero.getByRole('link', { name: /Hiện vật 1/ })).toHaveAttribute('href', `/collection/sculpture/exhibits/${imageExhibit.id}`);
  await expect(hero.getByRole('img', { name: 'Ảnh hiện vật' })).toHaveCount(0);
});

test('homepage story presents real 3D and audio features with working 3D and 2D links', async ({ page }) => {
  await installMuseumApi(page);
  for (const [width, expectedColumns] of [[390, 1], [768, 1], [1440, 2]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const story = page.getByRole('region', { name: 'Hai cách khám phá di sản' });
    await expect(story.getByRole('heading', { level: 2 })).toHaveText('Hai cách khám phá di sản');
    await expect(story.getByText('Chọn tham quan 3D hoặc xem bộ sưu tập hiện vật ở dạng 2D.')).toBeVisible();
    await expect(story.getByRole('listitem')).toHaveCount(2);
    await expect(story.getByText('Tham quan trong không gian 3D')).toBeVisible();
    await expect(story.getByText('Lắng nghe thuyết minh')).toBeVisible();
    const tourLink = story.getByRole('link', { name: 'Vào tham quan 3D' });
    await expect(tourLink).toHaveAttribute('href', '/tour');
    await expect(story.getByRole('link', { name: 'Xem bộ sưu tập 2D' })).toHaveAttribute('href', '/collection');
    await expect(story.getByText(/WCAG|100%|Quest|Pico|Vive|WebXR/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const columns = await story.evaluate((section) =>
      getComputedStyle(section.firstElementChild!).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(expectedColumns);
    if (width === 1440) {
      await tourLink.focus();
      await tourLink.press('Enter');
      await expect(page).toHaveURL(/\/tour$/);
    }
  }
});

test('homepage section semantics follow the visual order and respect reduced motion', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('main h2')).toHaveText(['Hiện vật nổi bật', 'Hai cách khám phá di sản']);
  for (const [selector, id] of [
    ['section[aria-labelledby="home-title"]', 'home-title'],
    ['section[aria-labelledby="featured-title"]', 'featured-title'],
    ['section[aria-labelledby="immersive-title"]', 'immersive-title'],
  ]) {
    await expect(page.locator(selector)).toHaveAttribute('aria-labelledby', id);
    await expect(page.locator(`#${id}`)).toBeVisible();
  }

  const hero = page.locator('section[aria-labelledby="home-title"]');
  await expect(hero.locator('div[aria-hidden="true"]')).toHaveCount(1);
  const tourLink = hero.getByRole('link', { name: 'Khám phá Không gian 3D (WebXR)' });
  await tourLink.focus();
  await expect(tourLink).toHaveCSS('outline-style', 'solid');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await tourLink.evaluate((link) => getComputedStyle(link).transitionProperty)).toBe('none');
});
