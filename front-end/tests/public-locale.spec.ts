import { expect, test } from '@playwright/test';

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
