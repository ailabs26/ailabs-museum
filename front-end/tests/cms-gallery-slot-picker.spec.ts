import { expect, test, type Page } from '@playwright/test';
import { installExhibitEditApi } from './fixtures/exhibitEditApi';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

// Gallery Template V1 — khớp `GALLERY_SLOTS`.
const S01 = { x: 0, y: 0, z: -2 }, S02 = { x: -4.3, y: 0, z: -4.2 }, S03 = { x: 4.3, y: 0, z: -4.2 }, S05 = { x: 4.3, y: 0, z: 2.1 };
const slot = (page: Page, number: number) => page.getByRole('dialog').getByRole('radio', { name: new RegExp(`^Bục 0${number} `) });
const openPositionTab = (page: Page) => page.getByRole('tab', { name: 'Vị trí 3D & Khối tạm' }).click();
async function edit(page: Page, name: string) {
  await page.getByRole('row').filter({ hasText: name }).getByRole('button').nth(1).click();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Tên hiện vật (Tiếng Việt)', exact: true })).toHaveValue(name);
}
async function install(page: Page, positions: { x: number; y: number; z: number }[]) {
  const state = await installExhibitEditApi(page);
  positions.forEach((position, index) => { state.records[index].content.position = position; });
  const created: { position?: unknown }[] = [];
  await page.route('**/api/admin/exhibits', async (route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    created.push(route.request().postDataJSON());
    await fulfillMuseum(route, envelope({ ...state.records[0], id: '10000000-0000-4000-8000-000000000009' }));
  });
  await page.goto('/admin/exhibits');
  return { state, created };
}

test('a new exhibit takes the first free plinth; occupied plinths are locked', async ({ page }) => {
  const { created } = await install(page, [S01, S03]);
  await page.getByRole('button', { name: 'Thêm hiện vật', exact: true }).click();
  await openPositionTab(page);
  await expect(slot(page, 2)).toBeChecked();
  await expect(slot(page, 1)).toBeDisabled();
  await expect(slot(page, 1)).toHaveAccessibleName(/đã có hiện vật: Hiện vật 1/);
  await expect(slot(page, 3)).toBeDisabled();
  await expect(slot(page, 4)).toHaveAccessibleName(/trống/);
  await slot(page, 5).click();
  await expect(slot(page, 5)).toBeChecked();
  await expect(slot(page, 2)).not.toBeChecked();
  await page.getByRole('tab', { name: 'Thông tin cơ bản' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Tên hiện vật (Tiếng Việt)', exact: true }).fill('Hiện vật mới');
  await page.getByRole('button', { name: 'Tạo bản nháp', exact: true }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].position).toEqual(S05);
});

test('a new room offers five empty plinths and defaults to the centre', async ({ page }) => {
  const { state } = await install(page, []);
  state.records.length = 0;
  await page.reload();
  await page.getByRole('button', { name: 'Thêm hiện vật', exact: true }).click();
  await openPositionTab(page);
  await expect(slot(page, 1)).toBeChecked();
  for (const number of [1, 2, 3, 4, 5]) await expect(slot(page, number)).toBeEnabled();
  await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(5);
});

test('editing keeps the exhibit on its own plinth and never rewrites its position on load', async ({ page }) => {
  const { state } = await install(page, [S01, S03]);
  await edit(page, 'Hiện vật 1');
  await openPositionTab(page);
  await expect(slot(page, 1)).toBeChecked();
  await expect(slot(page, 1)).toBeEnabled();
  await expect(slot(page, 3)).toBeDisabled();
  await page.waitForTimeout(1500);
  expect(state.patches).toEqual([]);
  await slot(page, 2).click();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect.poll(() => state.patches.at(-1)?.body.position).toEqual(S02);
});

test('free coordinates stay untouched and remain editable under advanced options', async ({ page }) => {
  const { state } = await install(page, [{ x: 1.5, y: 0, z: 3 }, S01]);
  await edit(page, 'Hiện vật 1');
  await openPositionTab(page);
  await expect(page.getByRole('dialog').getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText(/đang dùng tọa độ tự do \(X 1\.5, Y 0, Z 3\)/)).toBeVisible();
  const advanced = page.locator('[data-advanced-position]');
  await expect(advanced).not.toHaveAttribute('open', '');
  await advanced.locator('summary').click();
  await expect(advanced.getByRole('textbox', { name: 'X', exact: true })).toHaveValue('1.5');
  await expect(advanced.getByRole('textbox', { name: 'Z', exact: true })).toHaveValue('3');
  await page.waitForTimeout(1500);
  expect(state.patches).toEqual([]);
});

test('a stale conflict is called out instead of silently replacing the other exhibit', async ({ page }) => {
  await install(page, [S01, S01]);
  await edit(page, 'Hiện vật 2');
  await openPositionTab(page);
  await expect(slot(page, 1)).toBeChecked();
  await expect(page.getByRole('dialog').getByRole('alert').filter({ hasText: 'Bục 01 – Trung tâm đã có hiện vật «Hiện vật 1»' })).toBeVisible();
});
