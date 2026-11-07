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
