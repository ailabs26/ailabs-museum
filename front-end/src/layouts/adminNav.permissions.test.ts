import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/core/auth/permissions';
import { ADMIN_NAV, type NavItem } from './adminNav';

function canSeeNavItem(item: NavItem, grantedPermissions: readonly string[]): boolean {
  const granted = new Set(grantedPermissions);
  const matchesAny = !item.anyOf?.length || item.anyOf.some((code) => granted.has(code));
  const matchesAll = !item.allOf?.length || item.allOf.every((code) => granted.has(code));
  return matchesAny && matchesAll;
}

describe('Admin RBAC synchronization for Translations and Partner API Keys (#111)', () => {
  const allItems = ADMIN_NAV.flatMap((group) => group.items);
  const translationsItem = allItems.find((item) => item.to === '/admin/translations');
  const apiKeysItem = allItems.find((item) => item.to === '/admin/api-keys');

  it('requires strictly translation:read for /admin/translations nav item without exhibit:read fallback', () => {
    expect(translationsItem).toBeDefined();
    expect(translationsItem?.anyOf).toEqual([PERMISSIONS.TRANSLATION_READ]);

    expect(canSeeNavItem(translationsItem!, [PERMISSIONS.EXHIBIT_READ, PERMISSIONS.EXHIBIT_UPDATE])).toBe(false);
    expect(canSeeNavItem(translationsItem!, [PERMISSIONS.TRANSLATION_READ])).toBe(true);
  });

  it('requires strictly apikey:read for /admin/api-keys nav item without user:read fallback', () => {
    expect(apiKeysItem).toBeDefined();
    expect(apiKeysItem?.anyOf).toEqual([PERMISSIONS.APIKEY_READ]);

    expect(canSeeNavItem(apiKeysItem!, [PERMISSIONS.USER_READ, PERMISSIONS.USER_CREATE])).toBe(false);
    expect(canSeeNavItem(apiKeysItem!, [PERMISSIONS.APIKEY_READ])).toBe(true);
  });

  it('keeps router.tsx, TranslationsPage.tsx, and ApiKeysPage.tsx free of fallback permissions', () => {
    const srcRoot = resolve(__dirname, '..');
    const routerSource = readFileSync(resolve(srcRoot, 'app/router.tsx'), 'utf8');
    const translationsPageSource = readFileSync(resolve(srcRoot, 'pages/admin/TranslationsPage.tsx'), 'utf8');
    const apiKeysPageSource = readFileSync(resolve(srcRoot, 'pages/admin/ApiKeysPage.tsx'), 'utf8');

    expect(routerSource).toContain('anyOf={[PERMISSIONS.TRANSLATION_READ]}');
    expect(routerSource).not.toContain('PERMISSIONS.TRANSLATION_READ, PERMISSIONS.EXHIBIT_READ');

    expect(routerSource).toContain('anyOf={[PERMISSIONS.APIKEY_READ]}');
    expect(routerSource).not.toContain('PERMISSIONS.APIKEY_READ, PERMISSIONS.USER_READ');

    expect(translationsPageSource).toContain('const canManage = hasPermission(PERMISSIONS.TRANSLATION_MANAGE);');
    expect(translationsPageSource).not.toContain('PERMISSIONS.EXHIBIT_UPDATE');

    expect(apiKeysPageSource).toContain('const canManage = hasPermission(PERMISSIONS.APIKEY_MANAGE);');
    expect(apiKeysPageSource).not.toContain('PERMISSIONS.USER_CREATE');
  });
});

