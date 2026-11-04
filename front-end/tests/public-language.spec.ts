import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

/** Chuỗi UI từ CMS theo ngôn ngữ; `en` đủ, `ja` chỉ một phần để kiểm dự phòng. */
const STRINGS: Record<string, Record<string, string>> = {
  en: { 'ui.nav.collection': 'Collection', 'ui.collection.title': 'Our Collection', 'ui.collection.refresh': 'Refresh', 'ui.language.label': 'Language' },
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

test('320px: không tràn ngang; ô ngôn ngữ nằm trong menu và vẫn đổi được', async ({ page }) => {
  await install(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
