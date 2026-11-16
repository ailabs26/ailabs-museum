import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';

test('public shell does not overflow across supported widths in both themes', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/');
  const capture = process.env.PUBLIC_FOUNDATION_CAPTURE;
  if (capture) await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }" });

  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} at ${width}px`).toBe(true);
      const header = page.locator('header');
      if (width < 992) {
        await expect(header.getByRole('button', { name: 'Mở menu điều hướng' })).toBeVisible();
        await expect(header.getByRole('navigation', { name: 'Điều hướng chính' })).toBeHidden();
      } else {
        await expect(header.getByRole('button', { name: 'Mở menu điều hướng' })).toBeHidden();
        await expect(header.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
      }
      if (width >= 992) {
        const positions = await page.locator('header').evaluate((header) => {
          const bounds = (selector: string) => {
            const rect = header.querySelector(selector)!.getBoundingClientRect();
            return { left: rect.left, right: rect.right };
          };
          return {
            brand: bounds('a[aria-label="Aura Museum — Trang chủ"]'),
            navigation: bounds('nav[aria-label="Điều hướng chính"]'),
            action: bounds('a[aria-label="Vào không gian 3D"]'),
          };
        });
        expect(positions.brand.right, `${theme} brand/nav at ${width}px`).toBeLessThanOrEqual(positions.navigation.left);
        expect(positions.navigation.right, `${theme} nav/actions at ${width}px`).toBeLessThanOrEqual(positions.action.left);
      }
      if (capture) {
        await page.locator('header').screenshot({ path: `test-results/public-foundation-${capture}-${theme}-header-${width}.png` });
        await page.locator('footer').screenshot({ path: `test-results/public-foundation-${capture}-${theme}-footer-${width}.png` });
      }
    }
  }
});

test('public foundation exposes only real shell destinations and accessible landmarks', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/');

  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(navigation.getByRole('link')).toHaveCount(3);
  await expect(navigation.getByRole('link', { name: 'Trang chủ', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Aura Museum — Trang chủ' })).toHaveAttribute('href', '/');

  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/');
  await expect(footer.getByRole('link', { name: 'Bộ sưu tập 2D' })).toHaveAttribute('href', '/collection');
  await expect(footer.getByRole('link', { name: 'Tham quan 3D WebXR' })).toHaveAttribute('href', '/tour');
  await expect(footer.getByRole('link', { name: 'Cổng Quản trị viên' })).toHaveAttribute('href', '/admin');
});

test('footer avoids unsupported accessibility certification claims', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/');

  await expect(page.getByRole('contentinfo')).not.toContainText('WCAG 2.2 AA');
});

test('public footer stays at the viewport bottom on short content', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/tests/fixtures/public-locale.html?layout');

  const footer = await page.locator('footer').boundingBox();
  expect(footer).not.toBeNull();
  expect(footer!.y + footer!.height).toBeGreaterThanOrEqual(900);
});

test('footer focus indicator contrasts against its dark surface', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/');

  const link = page.getByRole('contentinfo').getByRole('link', { name: 'Trang chủ' });
  await link.focus();
  await expect(link).toHaveCSS('outline-color', 'rgb(147, 197, 253)');
});

test('public palette stays scoped and changes with the theme', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/');

  const colors = () => page.evaluate(() => {
    const layout = document.querySelector('header')!.parentElement!;
    const styles = getComputedStyle(layout);
    return {
      publicBg: styles.getPropertyValue('--public-bg').trim().toLowerCase(),
      layoutBg: styles.backgroundColor,
      layoutColor: styles.color,
      globalBg: getComputedStyle(document.documentElement).getPropertyValue('--aura-bg').trim().toLowerCase(),
    };
  });

  await expect.poll(colors).toEqual({ publicBg: '#f5efe5', layoutBg: 'rgb(248, 250, 252)', layoutColor: 'rgb(15, 23, 42)', globalBg: '#f8fafc' });
  await page.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click();
  await expect.poll(colors).toEqual({ publicBg: '#121c1a', layoutBg: 'rgb(10, 14, 23)', layoutColor: 'rgb(241, 245, 249)', globalBg: '#0a0e17' });
});

test('mobile 3D CTA keeps an accessible name when its label is visually hidden', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Vào không gian 3D' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vào không gian 3D' })).toHaveCSS('color', 'rgb(255, 249, 240)');
});

test('mobile Drawer styles its portal and keeps theme and locale controls usable', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await trigger.click();
  const drawer = page.getByRole('dialog');
  if (process.env.PUBLIC_FOUNDATION_CAPTURE) await drawer.screenshot({ path: 'test-results/public-foundation-after-drawer-390-light.png' });
  const background = () => drawer.evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect.poll(background).toBe('rgb(245, 239, 229)');
  await expect(drawer.getByRole('link', { name: 'Trang chủ', exact: true })).toHaveCSS('text-decoration-line', 'none');
  await drawer.getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await drawer.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click();
  await expect.poll(background).toBe('rgb(18, 28, 26)');
  if (process.env.PUBLIC_FOUNDATION_CAPTURE) await drawer.screenshot({ path: 'test-results/public-foundation-after-drawer-390-dark.png' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

test('tablet navigation opens its Drawer at 768px', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await trigger.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link')).toHaveCount(3);
  if (process.env.PUBLIC_FOUNDATION_CAPTURE) await drawer.screenshot({ path: 'test-results/public-foundation-after-drawer-768.png' });
  await page.keyboard.press('Shift+Tab');
  expect(await drawer.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await page.mouse.click(160, 450);
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('mobile Drawer continues the guided tour at its current exhibit and pauses it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/fixtures/public-locale.html?guided-tour');
  await page.getByRole('button', { name: 'Start tour' }).click();
  await expect(page.getByTestId('guided-status')).toHaveText('running');
  await expect(page.getByTestId('guided-current')).toHaveText(roomA.exhibits[0].id);

  await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
  const tourLink = page.getByRole('dialog').getByRole('link', { name: 'Tham quan 3D', exact: true });
  await expect(tourLink).toHaveAttribute('href', `/tour?room=sculpture&exhibit=${roomA.exhibits[0].id}`);
  await tourLink.click();

  await expect(page.getByTestId('guided-status')).toHaveText('paused');
  await expect(page.getByTestId('guided-current')).toHaveText(roomA.exhibits[0].id);
  await expect(page.getByRole('dialog')).toBeHidden();
});
