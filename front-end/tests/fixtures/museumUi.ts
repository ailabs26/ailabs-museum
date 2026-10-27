import { expect, type Page } from '@playwright/test';

/** Select the active catalogue; the inert page keeps its geometry for scroll restoration. */
export function museumExhibitButton(page: Page, name: string) {
  return page.locator('#museum-catalogue').getByRole('button', { name, exact: true, includeHidden: true });
}
export async function openMuseumCatalogue(page: Page) {
  const menu = page.locator('[data-catalogue]');
  if (await menu.isVisible() && await menu.getAttribute('open') === null) await menu.locator('summary').click();
}
export async function selectMuseumExhibit(page: Page, name: string) {
  await expect(museumExhibitButton(page, name)).toBeAttached();
  await openMuseumCatalogue(page);
  await museumExhibitButton(page, name).click();
}
export function museumHotspotButton(page: Page, name: string) {
  return page.locator('[data-hotspots]').getByRole('button', { name, exact: true, includeHidden: true });
}
export async function openMuseumHotspots(page: Page) {
  const catalogue = page.locator('[data-catalogue]');
  if (await catalogue.getAttribute('open') !== null) await catalogue.locator('summary').click();
  const menu = page.locator('[data-hotspots]');
  if (await menu.getAttribute('open') === null) await menu.locator('summary').click();
}
export async function selectMuseumHotspot(page: Page, name: string) {
  await openMuseumHotspots(page);
  await museumHotspotButton(page, name).click();
}
export async function exitMuseumIfOpen(page: Page) {
  const exit = page.getByRole('button', { name: 'Thoát tham quan', exact: true });
  if (await exit.isVisible()) {
    await exit.click();
    await expect(page.locator('[data-immersive-tour]')).toHaveCount(0);
  }
}
export async function refreshMuseum(page: Page) {
  await openMuseumCatalogue(page);
  const host = page.locator('[data-immersive-tour]');
  const scope = await host.isVisible() ? host : page.locator('#public-content');
  await scope.getByRole('button', { name: 'Làm mới', exact: true }).click();
}
export async function openMuseumTools(page: Page) {
  const summary = page.getByLabel('Thêm điều khiển', { exact: true });
  const isOpen = await summary.evaluate(node => node.parentElement?.hasAttribute('open'));
  if (!isOpen) await summary.click();
}
