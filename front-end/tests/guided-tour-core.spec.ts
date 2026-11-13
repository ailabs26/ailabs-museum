import { expect, test } from '@playwright/test';

test('guided tour persists across public routes, stays outside admin, and resets on reload', async ({ page }) => {
  await page.route('**/api/public/translations**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }),
  }));
  await page.goto('/tests/fixtures/public-locale.html?guided-tour');
  const status = page.getByTestId('guided-status');
  await expect(status).toHaveText('idle');

  await page.getByRole('button', { name: 'Start tour' }).click();
  await expect(status).toHaveText('running');
  await expect(page.getByTestId('guided-current')).toHaveText('10000000-0000-4000-8000-000000000001');
  await page.getByRole('button', { name: 'Pause tour' }).click();
  await expect(status).toHaveText('paused');
  await page.getByRole('button', { name: 'Resume tour' }).click();
  await expect(status).toHaveText('running');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByTestId('guided-current')).toHaveText('10000000-0000-4000-8000-000000000002');

  await page.getByRole('link', { name: 'Go to second public route' }).click();
  await expect(status).toHaveText('running');
  await expect(page.getByTestId('guided-index')).toHaveText('1/5');

  await page.getByRole('link', { name: 'Go to admin fixture' }).click();
  await expect(page.getByTestId('admin-fixture')).toBeVisible();
  await expect(status).toHaveCount(0);
  await page.getByRole('link', { name: 'Return to public route' }).click();
  await expect(status).toHaveText('idle');

  await page.getByRole('button', { name: 'Start tour' }).click();
  await expect(status).toHaveText('running');
  await page.getByRole('button', { name: 'Exit tour' }).click();
  await expect(status).toHaveText('idle');
  await page.getByRole('button', { name: 'Start tour' }).click();
  await expect(status).toHaveText('running');
  await page.reload();
  await expect(page.getByTestId('guided-status')).toHaveText('idle');
});

test('useGuidedTour reports a missing MuseumProvider', async ({ page }) => {
  const error = page.waitForEvent('pageerror');
  await page.goto('/tests/fixtures/public-locale.html?guided-tour-outside');
  await expect(error).resolves.toMatchObject({ message: 'useGuidedTour must be used within MuseumProvider' });
});
