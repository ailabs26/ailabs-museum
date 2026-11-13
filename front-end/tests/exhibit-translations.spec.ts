import { expect, test } from '@playwright/test';
import { installExhibitEditApi } from './fixtures/exhibitEditApi';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

test.describe('CMS: tab Bản dịch', () => {
  test('nhập bản dịch mới, giữ bản dịch cũ và ô trống không gửi lên', async ({ page }) => {
    const state = await installExhibitEditApi(page);
    state.records[0].content.name = { vi: 'Hiện vật 1', en: 'Item 1', fr: 'Objet 1' };
    await page.goto('/admin/exhibits');
    await page.getByRole('row').filter({ hasText: 'Hiện vật 1' }).getByRole('button').nth(1).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Bản dịch' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Tên hiện vật (Français)' })).toHaveValue('Objet 1');
    await expect(dialog.getByText('Français 1/4')).toBeVisible();

    await dialog.getByText('한국어 0/4').click();
    await dialog.getByRole('textbox', { name: 'Tên hiện vật (한국어)' }).fill(' 꽃병 ');
    await expect(dialog.getByText('한국어 1/4')).toBeVisible();
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();

    await expect.poll(() => state.patches.at(-1)?.body.name).toEqual({ vi: 'Hiện vật 1', en: 'Item 1', fr: 'Objet 1', ko: '꽃병' });
  });
});

test.describe('Khách: đổi ngôn ngữ và fallback', () => {
  const copy = (name: string | null, description: string | null, transcript: string | null = null) => ({ name, description, transcript });
  const translated = {
    ...roomA.exhibits[0],
    transcript: 'Thuyết minh',
    i18n: {
      vi: copy('Hiện vật 1', 'Mô tả hiện vật 1', 'Thuyết minh'),
      en: copy('Item 1', null),
      ko: copy('꽃병', '', '한국어 해설'),
      ja: copy(null, null),
    },
    hotspots: [{
      id: '30000000-0000-4000-8000-000000000001', label: 'Miệng', body: 'Thân', displayOrder: 1,
      positionX: 0, positionY: 0, positionZ: 0,
      i18n: { vi: { label: 'Miệng', body: 'Thân' }, en: { label: null, body: null }, ko: { label: '입구', body: null } },
    }],
  };

  test.beforeEach(async ({ page }) => {
    await installMuseumApi(page);
    await page.route('**/api/rooms/sculpture', (route) =>
      fulfillMuseum(route, envelope({ ...roomA, exhibits: [translated, ...roomA.exhibits.slice(1)] })));
  });

  test('có bản dịch thì hiện bản dịch, ô thiếu về tiếng Việt; chưa dịch thì báo rõ', async ({ page }) => {
    await page.goto(`/collection/sculpture/exhibits/${translated.id}`);
    await expect(page.getByRole('heading', { name: 'Hiện vật 1', level: 1 })).toBeVisible();
    const language = page.getByRole('combobox', { name: 'Ngôn ngữ' }).first();

    await language.selectOption('ko');
    await expect(page.getByRole('heading', { name: '꽃병', level: 1 })).toBeVisible();
    await expect(page.getByText('Mô tả hiện vật 1')).toBeVisible();
    await expect(page.getByText('한국어 해설')).toBeVisible();
    await expect(page.getByText('입구')).toBeVisible();
    await expect(page.getByText('Thân', { exact: true })).toBeVisible();
    await expect(page.getByRole('note')).toHaveCount(0);

    await language.selectOption('ja');
    await expect(page.getByRole('heading', { name: 'Hiện vật 1', level: 1 })).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Chưa có bản dịch, đang hiển thị tiếng Việt.');
  });
});
