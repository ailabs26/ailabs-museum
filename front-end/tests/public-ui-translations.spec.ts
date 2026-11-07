import { expect, test, type Locator, type Page } from '@playwright/test';
import { PUBLIC_UI_STRINGS } from '../../back-end/src/database/seeds/public-ui-strings';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

type Locale = keyof (typeof PUBLIC_UI_STRINGS)[number]['values'];

/** Chữ cái chỉ tiếng Việt mới có; không khớp nghĩa là vùng đó không còn chữ tiếng Việt. */
const VIETNAMESE = /[ăđơưĂĐƠƯạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/;

async function installStrings(page: Page, override: Record<string, string> = {}) {
  await page.route('**/api/public/translations**', (route) => {
    const locale = new URL(route.request().url()).searchParams.get('locale') as Locale;
    const strings = Object.fromEntries(PUBLIC_UI_STRINGS.map((item) => [item.namespace, item.values[locale]]));
    return fulfillMuseum(route, envelope({ ...strings, ...override }));
  });
}

async function expectNoVietnamese(area: Locator) {
  // Ô chọn ngôn ngữ luôn ghi tên tiếng Việt bằng chính tiếng Việt.
  expect((await area.innerText()).replace('Tiếng Việt', '')).not.toMatch(VIETNAMESE);
}

const chooseLanguage = (page: Page, locale: string) => page.getByRole('combobox', { name: /./ }).first().selectOption(locale);

test.describe('Giao diện Client theo ngôn ngữ', () => {
  test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

  for (const locale of ['en', 'fr', 'zh', 'ko', 'ja'] as const) {
    test(`${locale}: header, footer và trang chủ không còn chữ tiếng Việt`, async ({ page }) => {
      await installStrings(page);
      await page.goto('/');
      await chooseLanguage(page, locale);
      const value = (key: string) => PUBLIC_UI_STRINGS.find((item) => item.namespace === key)!.values[locale];
      await expect(page.getByRole('heading', { level: 1 })).toContainText(value('ui.home.title.first'));

      await expectNoVietnamese(page.locator('header'));
      await expectNoVietnamese(page.locator('footer'));
      await expectNoVietnamese(page.locator('section[aria-labelledby="about-title"]'));
      await expectNoVietnamese(page.locator('section[aria-labelledby="home-title"]'));
      await expect(page.getByRole('heading', { name: value('ui.home.featured.title') })).toBeVisible();
    });
  }

  test('chuỗi chưa dịch hoặc API lỗi thì hiện chữ dự phòng', async ({ page }) => {
    await page.route('**/api/public/translations**', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Chạm vào Di sản.');
    await chooseLanguage(page, 'ko');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Chạm vào Di sản.');
  });

  test('sửa bản tiếng Việt trên CMS thì trang đổi theo', async ({ page }) => {
    await installStrings(page, { 'ui.home.title.first': 'Tiêu đề do Admin sửa.' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tiêu đề do Admin sửa.');
  });

  test('trang 404 cũng theo ngôn ngữ đã chọn', async ({ page }) => {
    await installStrings(page);
    await page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', '{"version":1,"value":"ko"}'));
    await page.goto('/khong-co-trang-nay');
    await expect(page.getByText('요청하신 페이지를 찾을 수 없습니다.')).toBeVisible();
  });
});

test.describe('Bộ sưu tập và chi tiết theo ngôn ngữ', () => {
  const value = (key: string, locale: Locale = 'ko') => PUBLIC_UI_STRINGS.find((item) => item.namespace === key)!.values[locale];

  test.beforeEach(async ({ page }) => {
    await installMuseumApi(page);
    await installStrings(page);
    await page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', '{"version":1,"value":"ko"}'));
  });

  test('ko: tiêu đề, tìm kiếm, đếm, nút và lời nhắn đều đã dịch', async ({ page }) => {
    await page.goto('/collection?room=sculpture');
    await expect(page.getByRole('heading', { level: 1, name: value('ui.collection.title') })).toBeVisible();
    await expect(page.getByPlaceholder(value('ui.collection.search'))).toBeVisible();
    await expect(page.getByText(value('ui.collection.count').replace('{total}', '5'))).toBeVisible();
    await expect(page.getByRole('link', { name: value('ui.collection.tour-link') })).toBeVisible();
    await expect(page.getByRole('button', { name: value('ui.collection.compare-aria').replace('{name}', 'Hiện vật 1') })).toHaveText(value('ui.collection.compare'));
    await expect(page.getByText('Xem chi tiết')).toHaveCount(0);

    await page.getByPlaceholder(value('ui.collection.search')).fill('zzz');
    await expect(page.getByText(value('ui.collection.no-match').replace('{query}', 'zzz'), { exact: true })).toBeVisible();
  });

  test('ko: trang chi tiết dịch tiêu đề các mục và công cụ khách', async ({ page }) => {
    await page.goto('/collection/sculpture/exhibits/10000000-0000-4000-8000-000000000001');
    await expect(page.getByRole('heading', { level: 2, name: value('ui.exhibit.story') })).toBeVisible();
    await expect(page.getByRole('button', { name: value('ui.reading.mode'), exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: value('ui.theme.to-dark') })).toBeVisible();
    await expect(page.getByRole('textbox', { name: value('ui.notes.label') })).toBeVisible();
    await expect(page.getByRole('link', { name: value('ui.exhibit.back-to-room') })).toBeVisible();

    await page.getByRole('button', { name: value('ui.common.report-content') }).click();
    const dialog = page.getByRole('dialog', { name: value('ui.report.title') });
    await expect(dialog.getByRole('combobox', { name: value('ui.report.category') })).toContainText(value('ui.report.category.typo'));
    await expect(dialog.getByRole('textbox', { name: value('ui.report.details') })).toBeVisible();
    await expect(dialog.getByRole('button', { name: value('ui.report.send') })).toBeVisible();
  });
});

test('ko: trang tour dịch phần giới thiệu, nút mở 3D và danh mục', async ({ page }) => {
  const value = (key: string) => PUBLIC_UI_STRINGS.find((item) => item.namespace === key)!.values.ko;
  await installMuseumApi(page);
  await installStrings(page);
  await page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', '{"version":1,"value":"ko"}'));
  await page.goto('/tour?room=sculpture');
  await expect(page.getByText(value('ui.tour.eyebrow'))).toBeVisible();
  await expect(page.getByText(value('ui.tour.lead'))).toBeVisible();
  await expect(page.getByRole('button', { name: value('ui.tour.open') })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: value('ui.catalogue.title') })).toBeVisible();
  await expect(page.getByText(value('ui.tour.summary-shapes').replace('{count}', '5'))).toBeVisible();
  await expect(page.getByText('Mở phòng 3D')).toHaveCount(0);
});

test('tiêu đề tab và mô tả trang theo ngôn ngữ và theo trang', async ({ page }) => {
  const value = (key: string) => PUBLIC_UI_STRINGS.find((item) => item.namespace === key)!.values.ko;
  await installMuseumApi(page);
  await installStrings(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Aura Museum — Nghệ thuật và di sản');

  await page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', '{"version":1,"value":"ko"}'));
  await page.goto('/collection?room=sculpture');
  await expect(page).toHaveTitle(value('ui.meta.title').replace('{page}', value('ui.collection.title')));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', value('ui.meta.description'));

  await page.goto('/collection/sculpture/exhibits/10000000-0000-4000-8000-000000000001');
  await expect(page).toHaveTitle('Hiện vật 1 — Aura Museum');
  await page.goto('/khong-co-trang-nay');
  await expect(page).toHaveTitle(value('ui.meta.title').replace('{page}', value('ui.not-found.title')));
});

