import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';

test('two public consumers share locale updates', async ({ page }) => {
  await page.goto('/tests/fixtures/public-locale.html');

  await expect(page.getByTestId('locale-first')).toHaveText('vi');
  await expect(page.getByTestId('locale-second')).toHaveText('vi');
  await page.getByRole('button', { name: 'Set locale to English' }).click();
  await expect(page.getByTestId('locale-first')).toHaveText('en');
  await expect(page.getByTestId('locale-second')).toHaveText('en');
  await expect(page.getByTestId('storage-error')).toHaveText('none');
});

test('invalid saved locale falls back to vi without crashing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aura:visitor:locale:v1', '{"version":1,"value":"fr"}'));
  await page.goto('/tests/fixtures/public-locale.html');

  await expect(page.getByTestId('locale-first')).toHaveText('vi');
  await expect(page.getByTestId('storage-error')).toHaveText('invalid');
});

test('PublicLayout owns one locale provider across route changes', async ({ page }) => {
  await page.goto('/tests/fixtures/public-locale.html?layout');
  await expect(page.getByTestId('layout-locale-first')).toHaveText('vi');
  await page.getByRole('button', { name: 'Set layout locale to English' }).click();
  await page.getByRole('link', { name: 'Go to /second layout route' }).click();
  await expect(page.getByTestId('layout-locale-second')).toHaveText('en');
  await page.getByRole('link', { name: 'Go to /first layout route' }).click();
  await expect(page.getByTestId('layout-locale-first')).toHaveText('en');
});

test('public routes retain locale while Vietnamese content and admin stay unchanged', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/tests/fixtures/public-locale.html');
  await page.getByRole('button', { name: 'Set locale to English' }).click();

  for (const path of ['/', '/collection', `/collection/sculpture/exhibits/${roomA.exhibits[0].id}`, '/tour', '/tour.html']) {
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aura:visitor:locale:v1')!).value)).toBe('en');
  }

  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeVisible();
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập CMS' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await page.goto('/tests/fixtures/public-locale.html');
  await expect(page.getByTestId('locale-first')).toHaveText('en');
});

test('locale survives a full page reload', async ({ page }) => {
  await page.goto('/tests/fixtures/public-locale.html');
  await page.getByRole('button', { name: 'Set locale to English' }).click();
  await page.reload();
  await expect(page.getByTestId('locale-first')).toHaveText('en');
});

test('blocked storage keeps locale usable in the current tab', async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'aura:visitor:locale:v1') throw new DOMException('blocked', 'SecurityError');
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'aura:visitor:locale:v1') throw new DOMException('blocked', 'SecurityError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/tests/fixtures/public-locale.html');

  await expect(page.getByTestId('storage-error')).toHaveText('unavailable');
  await page.getByRole('button', { name: 'Set locale to English' }).click();
  await expect(page.getByTestId('locale-first')).toHaveText('en');
  await expect(page.getByTestId('locale-second')).toHaveText('en');
  await expect(page.getByTestId('storage-error')).toHaveText('unavailable');
});

test('another tab receives locale changes and removal', async ({ page, context }) => {
  await page.goto('/tests/fixtures/public-locale.html');
  const otherTab = await context.newPage();
  await otherTab.goto('/tests/fixtures/public-locale.html');
  await expect(otherTab.getByTestId('locale-first')).toHaveText('vi');

  await page.getByRole('button', { name: 'Set locale to English' }).click();
  await expect(otherTab.getByTestId('locale-first')).toHaveText('en');
  await page.evaluate(() => localStorage.removeItem('aura:visitor:locale:v1'));
  await expect(otherTab.getByTestId('locale-first')).toHaveText('vi');
  await otherTab.close();
});
