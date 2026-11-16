import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, exhibit, roomA, roomB, roomC, roomSummaries, ROOM_B_ID } from './fixtures/museumContent';

async function installHeroSlides(page: Page, prefix: string, count = 3) {
  await installMuseumApi(page);
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  const items = Array.from({ length: count }, (_, index) => roomA.exhibits[index] ?? exhibit(index + 1)).map((item, index) => ({
    ...item,
    name: `${prefix} exhibit ${index + 1}`,
    description: `Description ${index + 1}`,
    image: {
      id: `30000000-0000-4000-8000-00000000000${index + 1}`, url: `https://media.example/${prefix}-${index + 1}.svg`,
      mimeType: 'image/svg+xml', sizeBytes: 128, rights: { source: null, author: null, license: null },
      altText: { vi: `Alt ${index + 1}`, en: `Alt ${index + 1}` },
    },
  }));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: items })));
  return items;
}

test('hero keeps poster, localized copy, and detail route on the same published exhibit', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  const item = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA,
    exhibits: [{
      ...item,
      name: 'Tên hiện vật Việt',
      description: 'Mô tả tiếng Việt',
      i18n: {
        vi: { name: 'Tên hiện vật Việt', description: 'Mô tả tiếng Việt', transcript: null },
        en: { name: 'English exhibit name', description: 'English exhibit description', transcript: null },
      },
      image: {
        id: '30000000-0000-4000-8000-000000000001', url: 'https://media.example/hero.svg',
        mimeType: 'image/svg+xml', sizeBytes: 128, rights: { source: null, author: null, license: null },
        altText: { vi: 'Ảnh hiện vật tiếng Việt', en: 'English exhibit image' },
      },
    }],
  })));

  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const locale = page.getByRole('combobox').first();
  const detailHref = `/collection/${roomA.slug}/exhibits/${item.id}`;
  const detailLink = hero.locator(`a[href="${detailHref}"]`);

  await expect(hero.getByRole('img', { name: 'Ảnh hiện vật tiếng Việt' })).toBeVisible();
  await expect(hero.getByRole('heading', { level: 2, name: 'Tên hiện vật Việt' })).toBeVisible();
  await expect(hero.getByText('Mô tả tiếng Việt', { exact: true })).toBeVisible();
  await expect(detailLink).toBeVisible();

  await locale.selectOption('en');
  await expect(hero.getByRole('img', { name: 'English exhibit image' })).toBeVisible();
  await expect(hero.getByRole('heading', { level: 2, name: 'English exhibit name' })).toBeVisible();
  await expect(hero.getByText('English exhibit description', { exact: true })).toBeVisible();
  await expect(detailLink).toBeVisible();
});

test('failed hero image falls back without hiding exhibit metadata or the detail link', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('https://media.example/**', (route) => route.fulfill({ status: 404, body: '' }));
  const item = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA,
    exhibits: [{
      ...item,
      image: {
        id: '30000000-0000-4000-8000-000000000002', url: 'https://media.example/broken.webp',
        mimeType: 'image/webp', sizeBytes: 128, rights: { source: null, author: null, license: null },
        altText: { vi: item.name, en: item.name },
      },
    }],
  })));

  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  await expect(hero.getByRole('img')).toHaveCount(0);
  await expect(hero.getByRole('heading', { level: 2, name: item.name })).toBeVisible();
  await expect(hero.getByRole('link', { name: `Xem chi tiết ${item.name}` })).toBeVisible();
});

test('hero controls wrap, select a slide, and keep the poster, metadata, and link together', async ({ page }) => {
  const items = await installHeroSlides(page, 'Hero');

  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const next = hero.getByRole('button', { name: 'Hiện vật tiếp theo' });
  const previous = hero.getByRole('button', { name: 'Hiện vật trước' });
  const expectActive = async (index: number) => {
    await expect(hero.getByRole('img', { name: `Alt ${index}` })).toBeVisible();
    await expect(hero.getByRole('heading', { level: 2, name: `Hero exhibit ${index}` })).toBeVisible();
    await expect(hero.getByText(`Description ${index}`, { exact: true })).toBeVisible();
    await expect(hero.locator(`a[href="/collection/${roomA.slug}/exhibits/${items[index - 1].id}"]`)).toBeVisible();
  };

  await expectActive(1);
  await next.focus();
  await page.keyboard.press('Enter');
  await expectActive(2);
  await page.keyboard.press('Space');
  await expectActive(3);
  await next.click();
  await expectActive(1);
  await previous.click();
  await expectActive(3);
  const firstDot = hero.getByRole('button', { name: 'Đến hiện vật 1' });
  await firstDot.click();
  await expect(firstDot).toHaveAttribute('aria-pressed', 'true');
  await expectActive(1);
  const { width, height } = await firstDot.boundingBox() ?? { width: 0, height: 0 };
  expect(width).toBeGreaterThanOrEqual(44);
  expect(height).toBeGreaterThanOrEqual(44);
});

test('autoplay advances every six seconds, resets after manual navigation, and stays paused until resumed', async ({ page }) => {
  await page.clock.install();
  await installHeroSlides(page, 'Timed');
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const controls = hero.getByRole('group', { name: 'Điều khiển hiện vật nổi bật' });
  await expect(controls).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 60000));
  const activeDot = controls.locator('button[aria-pressed="true"]');
  const activeLabel = await activeDot.getAttribute('aria-label');
  let currentIndex = Number(activeLabel?.match(/\d+/)?.[0]);
  expect(currentIndex).toBeGreaterThanOrEqual(1);
  const expectActive = (index: number) => expect(hero.getByRole('heading', { level: 2, name: `Timed exhibit ${index}` })).toBeVisible();
  const leaveHero = async () => {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(1, 899);
  };
  await expectActive(currentIndex);
  await page.clock.fastForward(5999);
  await expectActive(currentIndex);
  await page.clock.fastForward(1);
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);

  await expect(hero.locator('[aria-live="polite"]')).toBeEmpty();

  await hero.getByRole('button', { name: 'Hiện vật tiếp theo' }).click();
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);
  await leaveHero();
  await page.clock.fastForward(5999);
  await expectActive(currentIndex);
  await page.clock.fastForward(1);
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);

  await hero.getByRole('button', { name: 'Tạm dừng tự chuyển' }).click();
  await leaveHero();
  await page.clock.fastForward(12000);
  await expectActive(currentIndex);
  await hero.getByRole('button', { name: 'Tiếp tục tự chuyển' }).click();
  await leaveHero();
  await page.clock.fastForward(6000);
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);
});

test('autoplay pauses on hover, focus, hidden tab, and offscreen hero', async ({ page }) => {
  await page.clock.install();
  await installHeroSlides(page, 'Lifecycle');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const controls = hero.getByRole('group', { name: 'Điều khiển hiện vật nổi bật' });
  await expect(controls).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 60000));
  const activeDot = controls.locator('button[aria-pressed="true"]');
  const activeLabel = await activeDot.getAttribute('aria-label');
  let currentIndex = Number(activeLabel?.match(/\d+/)?.[0]);
  const expectActive = (index: number) => expect(hero.getByRole('heading', { level: 2, name: `Lifecycle exhibit ${index}` })).toBeVisible();
  const leaveHero = async () => {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(1, 899);
  };

  await page.mouse.move(500, 400);
  await page.clock.fastForward(12000);
  await expectActive(currentIndex);
  await leaveHero();
  await page.clock.fastForward(6000);
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);

  await controls.getByRole('button', { name: 'Hiện vật tiếp theo' }).focus();
  await page.clock.fastForward(12000);
  await expectActive(currentIndex);
  await leaveHero();
  await page.clock.fastForward(6000);
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(12000);
  await expectActive(currentIndex);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(6000);
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    window.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => hero.evaluate((element) => element.getBoundingClientRect().bottom < 0)).toBe(true);
  await page.waitForTimeout(100);
  await page.clock.fastForward(12000);
  await expectActive(currentIndex);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(100);
  await page.clock.fastForward(6000);
  currentIndex = currentIndex % 3 + 1;
  await expectActive(currentIndex);
});

test('reduced motion disables autoplay by default but Resume remains an explicit opt-in', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installHeroSlides(page, 'Reduced');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const controls = hero.getByRole('group', { name: 'Điều khiển hiện vật nổi bật' });
  const resume = controls.getByRole('button', { name: 'Tiếp tục tự chuyển' });
  await expect(resume).toHaveAttribute('aria-pressed', 'true');
  await page.clock.pauseAt(new Date(Date.now() + 60000));
  const activeDot = controls.locator('button[aria-pressed="true"][aria-label^="Đến hiện vật"]');
  const currentLabel = await activeDot.getAttribute('aria-label');
  const currentIndex = Number(currentLabel?.match(/\d+/)?.[0]);
  await page.clock.fastForward(12000);
  await expect(hero.getByRole('heading', { level: 2, name: `Reduced exhibit ${currentIndex}` })).toBeVisible();

  await resume.click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(1, 899);
  await page.clock.fastForward(6000);
  await expect(hero.getByRole('heading', { level: 2, name: `Reduced exhibit ${currentIndex % 3 + 1}` })).toBeVisible();
});

test('hero eagerly loads the first poster and preloads only the next poster', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  const withPoster = (item: ReturnType<typeof exhibit>, index: number) => ({
    ...item,
    image: {
      id: `30000000-0000-4000-8000-00000000000${index}`, url: `https://media.example/preload-${index}.svg`,
      mimeType: 'image/svg+xml', sizeBytes: 128, rights: { source: null, author: null, license: null },
      altText: { vi: `Poster ${index}`, en: `Poster ${index}` },
    },
  });
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [withPoster(roomA.exhibits[0], 1)],
  })));
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, envelope({
    ...roomB, exhibits: [withPoster(exhibit(6, ROOM_B_ID), 2), withPoster(exhibit(7, ROOM_B_ID), 3)],
  })));
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'media.example') requests.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const firstPoster = hero.getByRole('img', { name: 'Poster 1' });
  await expect.poll(() => firstPoster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => requests).toHaveLength(2);
  await expect(firstPoster).toHaveAttribute('loading', 'eager');
  await expect(firstPoster).toHaveAttribute('fetchpriority', 'high');
  expect(requests).toEqual(['/preload-1.svg', '/preload-2.svg']);
});

test('hero keeps the current poster and metadata visible until the next poster loads', async ({ page }) => {
  const release = (() => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    return { pending, resolve: () => resolve() };
  })();
  await installHeroSlides(page, 'Delayed');
  await page.route('https://media.example/Delayed-2.svg', async (route) => {
    await release.pending;
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
  });
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  await expect(hero.getByRole('heading', { level: 2, name: 'Delayed exhibit 1' })).toBeVisible();
  await expect.poll(() => hero.getByRole('img', { name: 'Alt 1' }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await hero.getByRole('button', { name: 'Hiện vật tiếp theo' }).click();
  const incomingPoster = hero.locator('img[alt="Alt 2"]');
  await expect(incomingPoster).toBeAttached();
  await expect(hero.getByRole('heading', { level: 2, name: 'Delayed exhibit 1' })).toBeVisible();
  await expect.poll(() => incomingPoster.evaluate((image: HTMLImageElement) => getComputedStyle(image.parentElement!).opacity))
    .toBe('0');
  await expect.poll(() => hero.getByRole('img', { name: 'Alt 1' }).evaluate(
    (image: HTMLImageElement) => getComputedStyle(image.parentElement!).opacity,
  )).toBe('1');
  release.resolve();
  await expect(hero.getByRole('heading', { level: 2, name: 'Delayed exhibit 2' })).toBeVisible();
  await expect(hero.locator(`a[href="/collection/${roomA.slug}/exhibits/${roomA.exhibits[1].id}"]`)).toBeVisible();
});
test('broken carousel poster falls back without losing its matching metadata or retrying', async ({ page }) => {
  await installHeroSlides(page, 'Broken');
  let failedPosterRequests = 0;
  await page.route('https://media.example/Broken-2.svg', async (route) => {
    failedPosterRequests += 1;
    await route.abort();
  });
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  await expect.poll(() => hero.getByRole('img', { name: 'Alt 1' }).evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await hero.getByRole('button', { name: 'Hiện vật tiếp theo' }).click();
  await expect(hero.getByText('Hình minh họa thay thế')).toBeVisible();
  await expect(hero.getByRole('heading', { level: 2, name: 'Broken exhibit 2' })).toBeVisible();
  await expect(hero.locator(`a[href="/collection/${roomA.slug}/exhibits/${roomA.exhibits[1].id}"]`)).toBeVisible();
  const requestCountAfterFallback = failedPosterRequests;
  await page.waitForTimeout(700);
  expect(failedPosterRequests).toBe(requestCountAfterFallback);
});

test('reduced motion disables the crossfade and rapid navigation keeps the latest exhibit selected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const release = (() => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    return { pending, resolve: () => resolve() };
  })();
  await installHeroSlides(page, 'Rapid');
  await page.route('https://media.example/Rapid-2.svg', async (route) => {
    await release.pending;
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
  });
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  await expect.poll(() => hero.getByRole('img', { name: 'Alt 1' }).evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  const next = hero.getByRole('button', { name: 'Hiện vật tiếp theo' });
  await next.click();
  await next.click();
  await release.resolve();
  await expect(hero.getByRole('heading', { level: 2, name: 'Rapid exhibit 3' })).toBeVisible();
  await expect(hero.locator(`a[href="/collection/${roomA.slug}/exhibits/${roomA.exhibits[2].id}"]`)).toBeVisible();
  expect(await hero.getByRole('img', { name: 'Alt 3' }).evaluate(
    (image: HTMLImageElement) => parseFloat(getComputedStyle(image.parentElement!).transitionDuration),
  )).toBeLessThan(0.001);
});
test('hero swipe changes slides horizontally without blocking vertical gestures', async ({ page }) => {
  const items = await installHeroSlides(page, 'Swipe');
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const stage = hero.locator('[class*="heroStage"]');
  await expect.poll(() => hero.getByRole('img', { name: 'Alt 1' }).evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await stage.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 240, clientY: 200 });
  await stage.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 230, clientY: 280 });
  await expect(hero.getByRole('heading', { level: 2, name: 'Swipe exhibit 1' })).toBeVisible();
  await stage.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0, clientX: 240, clientY: 200 });
  await stage.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch', button: 0, clientX: 150, clientY: 205 });
  await expect(hero.getByRole('heading', { level: 2, name: 'Swipe exhibit 2' })).toBeVisible();
  await expect(hero.locator(`a[href="/collection/${roomA.slug}/exhibits/${items[1].id}"]`)).toBeVisible();
});

test('hero controls and stage fit the supported desktop, tablet, and phone widths', async ({ page }) => {
  await installHeroSlides(page, 'Responsive', 5);
  await page.goto('/');
  const widths = [320, 390, 768, 1024, 1280, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => {
      const hero = document.querySelector('section[aria-labelledby="home-title"]')!;
      const stage = hero.querySelector('[class*="heroStage"]')!;
      const rect = stage.getBoundingClientRect();
      const zone = (selector: string) => {
        const bounds = hero.querySelector(selector)!.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
      };
      const controls = Array.from(hero.querySelectorAll('[class*="heroControls"] button')).map((button) => {
        const bounds = button.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      });
      return {
        scrollWidth: document.documentElement.scrollWidth, width: innerWidth,
        stage: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width },
        content: zone('[class*="heroContent"]'), metadata: zone('[class*="heroMetadata"]'), controls,
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
    expect(geometry.stage.left).toBeGreaterThanOrEqual(0);
    expect(geometry.stage.right).toBeLessThanOrEqual(width);
    expect(geometry.controls).toHaveLength(8);
    expect(geometry.controls.every((button) => button.width >= 44 && button.height >= 44
      && button.left >= 0 && button.right <= width && button.top >= geometry.stage.top
      && button.bottom <= geometry.stage.bottom)).toBe(true);
    if (width <= 768) {
      expect(geometry.content.bottom).toBeLessThanOrEqual(geometry.stage.top);
      expect(geometry.stage.bottom).toBeLessThanOrEqual(geometry.metadata.top);
    } else if (width <= 1120) {
      expect(geometry.content.right).toBeLessThanOrEqual(geometry.stage.left);
      expect(geometry.content.right).toBeLessThanOrEqual(geometry.metadata.left);
      expect(geometry.stage.bottom).toBeLessThanOrEqual(geometry.metadata.top);
    } else {
      expect(geometry.content.right).toBeLessThanOrEqual(geometry.stage.left);
      expect(geometry.stage.right).toBeLessThanOrEqual(geometry.metadata.left);
    }
  }
});
test('hero supplements a sparse first room with at most two concurrent room queries and stops at three posters', async ({ page }) => {
  await installMuseumApi(page);
  const rooms = [
    ...roomSummaries,
    { id: '00000000-0000-4000-8000-000000000004', slug: 'fourth', name: 'Phòng bốn', description: null },
    { id: '00000000-0000-4000-8000-000000000005', slug: 'fifth', name: 'Phòng năm', description: null },
  ];
  const poster = (item: ReturnType<typeof exhibit>) => ({
    ...item,
    image: {
      id: '30000000-0000-4000-8000-000000000001',
      url: `https://media.example/${item.id}.webp`,
      mimeType: 'image/webp', sizeBytes: 128,
      rights: { source: null, author: null, license: null },
      altText: { vi: item.name, en: item.name },
    },
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope(rooms)));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [poster(roomA.exhibits[0])],
  })));
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, envelope({
    ...roomB, exhibits: [poster(exhibit(6, ROOM_B_ID)), poster(exhibit(7, ROOM_B_ID))],
  })));
  await page.route('**/api/rooms/empty', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fulfillMuseum(route, envelope(roomC));
  });

  await page.goto('/');
  await expect.poll(() => requests.filter((path) => path !== '/api/rooms/sculpture').length).toBeGreaterThan(0);
  await expect.poll(() => requests).toContain('/api/rooms/ceramics');
  await expect.poll(() => requests).toContain('/api/rooms/empty');
  expect(requests.filter((path) => /^\/api\/rooms\/(?!sculpture$)/.test(path))).toHaveLength(2);
  expect(requests).not.toContain('/api/rooms/fourth');
  expect(requests).not.toContain('/api/rooms/fifth');
  expect(requests.filter((path) => path === '/api/rooms/sculpture')).toHaveLength(1);
});

test('desktop hero places copy, large poster, and matching exhibit metadata in three separate zones', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><path d="M260 150h280l-38 300H298z" fill="#b99a68"/><ellipse cx="400" cy="150" rx="140" ry="24" fill="#d6ba88"/><path d="M298 450h204l42 32H256z" fill="#82694a"/></svg>',
  }));
  const item = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA,
    exhibits: [{
      ...item,
      description: 'Mô tả triển lãm cho poster ở giữa.',
      image: {
        id: '30000000-0000-4000-8000-000000000001', url: `https://media.example/${item.id}.svg`,
        mimeType: 'image/svg+xml', sizeBytes: 128, rights: { source: null, author: null, license: null },
        altText: { vi: 'Poster trung tâm', en: 'Center poster' },
      },
    }],
  })));

  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="home-title"]');
  const poster = hero.getByRole('img', { name: 'Poster trung tâm' });
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(hero.getByRole('heading', { level: 2, name: item.name })).toBeVisible();
  await expect(hero.getByText('Mô tả triển lãm cho poster ở giữa.', { exact: true })).toBeVisible();
  await expect(hero.getByRole('link', { name: `Xem chi tiết ${item.name}` })).toHaveAttribute(
    'href', `/collection/${roomA.slug}/exhibits/${item.id}`,
  );
  const zones = await hero.locator(':scope > div').evaluate((inner) => Array.from(inner.children).map((zone) => {
    const { x, width } = zone.getBoundingClientRect();
    return { x, width, right: x + width };
  }));
  expect(zones).toHaveLength(3);
  expect(zones[0].right).toBeLessThan(zones[1].x);
  expect(zones[1].right).toBeLessThan(zones[2].x);
  expect(zones[1].width / (zones[2].right - zones[0].x)).toBeGreaterThanOrEqual(0.4);
  const heroHeight = await hero.evaluate((section) => section.getBoundingClientRect().height);
  expect(heroHeight).toBeGreaterThanOrEqual(520);
  expect(heroHeight).toBeLessThanOrEqual(660);
});

test('hero does not fetch other rooms when the first room already has three posters', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  const poster = (item: ReturnType<typeof exhibit>) => ({
    ...item,
    image: {
      id: '30000000-0000-4000-8000-000000000001',
      url: `https://media.example/${item.id}.webp`,
      mimeType: 'image/webp', sizeBytes: 128,
      rights: { source: null, author: null, license: null },
      altText: { vi: item.name, en: item.name },
    },
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: roomA.exhibits.slice(0, 3).map(poster),
  })));

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Hiện vật nổi bật' }).getByRole('listitem')).toHaveCount(3);
  await page.waitForLoadState('networkidle');
  await expect.poll(() => requests).toEqual(['/api/rooms/sculpture']);
});

test('changing locale reuses the public room query cache', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('https://media.example/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  const poster = (item: ReturnType<typeof exhibit>) => ({
    ...item,
    image: {
      id: '30000000-0000-4000-8000-000000000001',
      url: `https://media.example/${item.id}.webp`,
      mimeType: 'image/webp', sizeBytes: 128,
      rights: { source: null, author: null, license: null },
      altText: { vi: item.name, en: item.name },
    },
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [poster(roomA.exhibits[0])],
  })));
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, envelope({
    ...roomB, exhibits: [poster(exhibit(6, ROOM_B_ID)), poster(exhibit(7, ROOM_B_ID))],
  })));

  await page.goto('/');
  await expect.poll(() => requests.filter((path) => path === '/api/rooms/ceramics').length).toBe(1);
  await expect.poll(() => requests.filter((path) => path === '/api/rooms/empty').length).toBe(1);
  const localeSelect = page.getByRole('combobox', { name: 'Ngôn ngữ' });
  await localeSelect.selectOption('en');
  await expect(localeSelect).toHaveValue('en');
  await page.waitForLoadState('networkidle');
  expect(requests.filter((path) => path !== '/api/rooms/sculpture')).toHaveLength(2);
});

test('hero stops after four supplemental rooms even when responses fail or have too few posters', async ({ page }) => {
  await installMuseumApi(page);
  const addedRooms = [
    { id: '00000000-0000-4000-8000-000000000004', slug: 'fourth', name: 'Phòng bốn', description: null },
    { id: '00000000-0000-4000-8000-000000000005', slug: 'fifth', name: 'Phòng năm', description: null },
    { id: '00000000-0000-4000-8000-000000000006', slug: 'sixth', name: 'Phòng sáu', description: null },
  ];
  const requests: string[] = [];
  let inFlight = 0;
  let maxConcurrent = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/rooms/')) requests.push(path);
  });
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([...roomSummaries, ...addedRooms])));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{
      ...exhibit(1), image: {
        id: '30000000-0000-4000-8000-000000000001', url: 'https://media.example/primary.webp',
        mimeType: 'image/webp', sizeBytes: 128, rights: { source: null, author: null, license: null }, altText: { vi: 'Ảnh', en: 'Image' },
      },
    }],
  })));
  const delayed = async (route: Parameters<typeof fulfillMuseum>[0], data: unknown) => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fulfillMuseum(route, envelope(data));
    inFlight -= 1;
  };
  await page.route('**/api/rooms/ceramics', (route) => delayed(route, { ...roomB, exhibits: [] }));
  await page.route('**/api/rooms/empty', async (route) => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) });
    inFlight -= 1;
  });
  await page.route('**/api/rooms/fourth', (route) => delayed(route, {
    ...roomB, id: addedRooms[0].id, slug: 'fourth',
    exhibits: [{
      ...exhibit(8, addedRooms[0].id), image: {
        id: '30000000-0000-4000-8000-000000000008', url: 'https://media.example/fourth.webp',
        mimeType: 'image/webp', sizeBytes: 128, rights: { source: null, author: null, license: null }, altText: { vi: 'Ảnh', en: 'Image' },
      },
    }],
  }));
  await page.route('**/api/rooms/fifth', (route) => delayed(route, { ...roomC, id: addedRooms[1].id, slug: 'fifth' }));

  await page.goto('/');
  await expect.poll(() => requests.filter((path) => path !== '/api/rooms/sculpture').length).toBe(4);
  expect(requests).toContain('/api/rooms/fourth');
  expect(requests).toContain('/api/rooms/fifth');
  expect(requests).not.toContain('/api/rooms/sixth');
  expect(maxConcurrent).toBe(2);
});
