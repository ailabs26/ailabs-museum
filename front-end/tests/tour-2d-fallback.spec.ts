import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('[F02] panel link follows selected exhibit and navigates to readable 2D detail', async ({ page }) => {
  await page.goto('/tour?room=sculpture');
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
  const link = page.getByRole('link', { name: 'Đọc chi tiết 2D', exact: true });
  await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[1].id}`);
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 3', exact: true }).click();
  await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[2].id}`);
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(link).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem chi tiết Bình gốm', exact: true }).click();
  await expect(link).toHaveAttribute('href', `/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
  await link.focus();
  await link.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bình gốm');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('canvas')).toHaveCount(0);
});

for (const failure of ['webgl', 'context', 'chunk']) {
  for (const selected of [false, true]) {
    test(`[F03] ${failure} failure offers contextual 2D link with selection=${selected}`, async ({ page }) => {
      if (failure === 'webgl') await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
          if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
          return Reflect.apply(getContext, this, [type, ...args]);
        } as typeof getContext;
      });
      if (failure === 'chunk') await page.route('**/*MuseumScene*', (route) => route.abort());
      await page.goto('/tour?room=sculpture');
      if (selected) await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
      await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
      if (failure === 'context') {
        const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
        await expect(canvas).toBeVisible();
        await canvas.evaluate((element: HTMLCanvasElement) => {
          const extension = element.getContext('webgl2')?.getExtension('WEBGL_lose_context');
          if (!extension) throw new Error('WebGL context-loss extension required');
          extension.loseContext();
        });
      }
      await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
      await expect(page).toHaveURL(/\/tour\?room=sculpture$/);
      const link = page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D', exact: true });
      await expect(link).toHaveAttribute('href', selected
        ? `/collection/sculpture/exhibits/${roomA.exhibits[1].id}` : '/collection?room=sculpture');
      await expect(page.getByRole('list', { name: 'Các hiện vật' }).getByRole('listitem')).toHaveCount(5);
      await expect(page.getByRole('link', { name: 'Đọc nội dung phòng trưng bày' })).toHaveAttribute('href', '#museum-catalogue');
      // The fallback follows subsequent DOM selection too, including an ErrorBoundary's fallback.
      await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 3', exact: true }).click();
      await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[2].id}`);
      await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
      await expect(link).toHaveAttribute('href', '/collection?room=sculpture');
    });
  }
}
