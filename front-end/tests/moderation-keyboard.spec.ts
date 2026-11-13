import { expect, test } from '@playwright/test';
import { installModerationApi, revisions } from './fixtures/moderationApi';

for (const key of ['Enter', 'Space']) {
  test(`moderation opens the correct duplicate-name revision with ${key}`, async ({ page }) => {
    const { detailRequests, writes } = await installModerationApi(page);
    await page.goto('/admin/moderation');
    await expect(page.getByRole('heading', { name: 'Kiểm duyệt nội dung' })).toBeVisible();
    const action = page.getByRole('button', { name: `Xem chi tiết Bình gốm, bản #2, ${revisions[1].id}`, exact: true });
    for (let index = 0; index < 30 && !await action.evaluate(element => element === document.activeElement); index++) {
      await page.keyboard.press('Tab');
    }
    await expect(action).toBeFocused();
    await page.keyboard.press(key);
    await expect(page.getByRole('dialog', { name: 'Bình gốm', exact: true })).toBeVisible();
    await expect.poll(() => detailRequests).toEqual([revisions[1].id]);
    expect(writes).toEqual([]);
  });
}

test('mouse action requests one record and pagination retains the empty state', async ({ page }) => {
  const { detailRequests, writes } = await installModerationApi(page);
  await page.goto('/admin/moderation');
  await page.getByRole('button', { name: `Xem chi tiết Bình gốm, bản #1, ${revisions[0].id}`, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bình gốm', exact: true })).toBeVisible();
  await expect.poll(() => detailRequests).toEqual([revisions[0].id]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '2', exact: true }).press('Enter');
  await expect(page.getByText('Không có phiên bản nào chờ duyệt', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});
