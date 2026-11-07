import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from '../../common/constants/permissions.constant';
import { RoleKey } from '../../common/enums/role.enum';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { PUBLIC_UI_STRINGS, seedRoles } from './seed';

function createInMemoryRbacStore() {
  const permissionsByCode = new Map<string, Permission>();
  const permissionsById = new Map<string, Permission>();
  for (const code of ALL_PERMISSIONS) {
    const entity = Object.assign(new Permission(), {
      id: `perm-${code}`,
      code,
      description: null,
    });
    permissionsByCode.set(code, entity);
    permissionsById.set(entity.id, entity);
  }

  const roles = new Map<RoleKey, Role>();
  const roleLinks = new Map<string, Set<string>>();

  const roleRepo = {
    findOne: async ({ where }: { where: { code?: RoleKey; isDeleted?: boolean } }) => {
      const role = where.code ? roles.get(where.code) : undefined;
      if (!role || (where.isDeleted === false && role.isDeleted)) return null;
      return role;
    },
    create: (data: Partial<Role>) =>
      Object.assign(new Role(), {
        id: `role-${data.code}`,
        code: data.code,
        name: data.name,
        isDeleted: false,
      }),
    save: async (role: Role) => {
      roles.set(role.code as RoleKey, role);
      if (!roleLinks.has(role.id)) roleLinks.set(role.id, new Set());
      return role;
    },
  };

  const linkRepo = {
    count: async ({ where }: { where?: { roleId?: string } }) => {
      const roleId = where?.roleId;
      return roleId ? (roleLinks.get(roleId)?.size ?? 0) : 0;
    },
    delete: async ({ roleId }: { roleId: string }) => {
      roleLinks.set(roleId, new Set());
    },
    create: (data: Partial<RolePermission>) =>
      Object.assign(new RolePermission(), {
        roleId: data.roleId!,
        permissionId: data.permissionId!,
      }),
    save: async (links: RolePermission[]) => {
      for (const link of links) {
        const set = roleLinks.get(link.roleId) ?? new Set<string>();
        set.add(link.permissionId);
        roleLinks.set(link.roleId, set);
      }
      return links;
    },
  };

  const getCodesForRole = (key: RoleKey): string[] => {
    const role = roles.get(key);
    if (!role) return [];
    return [...(roleLinks.get(role.id) ?? [])]
      .map((permId) => permissionsById.get(permId)?.code)
      .filter((code): code is string => Boolean(code))
      .sort();
  };

  const setCustomCodesForRole = (key: RoleKey, codes: string[]) => {
    const role = roles.get(key)!;
    roleLinks.set(
      role.id,
      new Set(codes.map((code) => permissionsByCode.get(code)!.id)),
    );
  };

  return {
    permissionsByCode,
    roleRepo,
    linkRepo,
    getCodesForRole,
    setCustomCodesForRole,
  };
}

describe('seedRoles — bảo toàn quyền RBAC tùy chỉnh (#112)', () => {
  it('gán đúng DEFAULT_ROLE_PERMISSIONS khi khởi tạo role lần đầu', async () => {
    const store = createInMemoryRbacStore();
    await seedRoles(store.permissionsByCode, {
      roleRepo: store.roleRepo as never,
      linkRepo: store.linkRepo as never,
    });

    assert.deepEqual(
      store.getCodesForRole(RoleKey.ADMIN),
      [...DEFAULT_ROLE_PERMISSIONS[RoleKey.ADMIN]].sort(),
    );
    assert.deepEqual(
      store.getCodesForRole(RoleKey.MODERATOR),
      [...DEFAULT_ROLE_PERMISSIONS[RoleKey.MODERATOR]].sort(),
    );
    assert.deepEqual(
      store.getCodesForRole(RoleKey.EDITOR),
      [...DEFAULT_ROLE_PERMISSIONS[RoleKey.EDITOR]].sort(),
    );
  });

  it('bảo toàn quyền RBAC đã tùy chỉnh của moderator/editor khi chạy lại seed (kể cả khi giảm về 0 quyền)', async () => {
    const store = createInMemoryRbacStore();
    await seedRoles(store.permissionsByCode, {
      roleRepo: store.roleRepo as never,
      linkRepo: store.linkRepo as never,
    });

    const customEditorCodes = [
      PERMISSIONS.EXHIBIT_READ,
      PERMISSIONS.TRANSLATION_READ,
      PERMISSIONS.TRANSLATION_MANAGE,
    ].sort();
    store.setCustomCodesForRole(RoleKey.EDITOR, customEditorCodes);
    store.setCustomCodesForRole(RoleKey.MODERATOR, []);

    await seedRoles(store.permissionsByCode, {
      roleRepo: store.roleRepo as never,
      linkRepo: store.linkRepo as never,
    });

    assert.deepEqual(store.getCodesForRole(RoleKey.EDITOR), customEditorCodes);
    assert.deepEqual(store.getCodesForRole(RoleKey.MODERATOR), []);
    assert.deepEqual(
      store.getCodesForRole(RoleKey.ADMIN),
      [...DEFAULT_ROLE_PERMISSIONS[RoleKey.ADMIN]].sort(),
    );
  });

  it('vẫn cập nhật quyền mới cho role admin khi chạy lại seed', async () => {
    const store = createInMemoryRbacStore();
    await seedRoles(store.permissionsByCode, {
      roleRepo: store.roleRepo as never,
      linkRepo: store.linkRepo as never,
    });

    // Giả lập admin đang thiếu quyền mới thêm vào hệ thống
    store.setCustomCodesForRole(RoleKey.ADMIN, [PERMISSIONS.ROOM_READ]);

    await seedRoles(store.permissionsByCode, {
      roleRepo: store.roleRepo as never,
      linkRepo: store.linkRepo as never,
    });

    assert.deepEqual(
      store.getCodesForRole(RoleKey.ADMIN),
      [...DEFAULT_ROLE_PERMISSIONS[RoleKey.ADMIN]].sort(),
    );
  });

  it('khôi phục quyền mặc định cho moderator/editor khi bật cờ resetCustomRbac (SEED_RESET_RBAC=true)', async () => {
    const store = createInMemoryRbacStore();
    await seedRoles(store.permissionsByCode, {
      roleRepo: store.roleRepo as never,
      linkRepo: store.linkRepo as never,
    });

    store.setCustomCodesForRole(RoleKey.EDITOR, [PERMISSIONS.EXHIBIT_READ]);
    store.setCustomCodesForRole(RoleKey.MODERATOR, [PERMISSIONS.REPORT_READ]);

    await seedRoles(store.permissionsByCode, {
      roleRepo: store.roleRepo as never,
      linkRepo: store.linkRepo as never,
      resetCustomRbac: true,
    });

    assert.deepEqual(
      store.getCodesForRole(RoleKey.EDITOR),
      [...DEFAULT_ROLE_PERMISSIONS[RoleKey.EDITOR]].sort(),
    );
    assert.deepEqual(
      store.getCodesForRole(RoleKey.MODERATOR),
      [...DEFAULT_ROLE_PERMISSIONS[RoleKey.MODERATOR]].sort(),
    );
  });
});

describe('PUBLIC_UI_STRINGS', () => {
  it('includes dynamic public report, media credit, and tour model failure keys', () => {
    const seededNamespaces = new Set(PUBLIC_UI_STRINGS.map(([namespace]) => namespace));
    const requiredNamespaces = [
      'ui.report.category.wrong_info',
      'ui.report.category.typo',
      'ui.report.category.inappropriate_content',
      'ui.report.category.other',
      'ui.report.validation.message-required',
      'ui.report.validation.message-too-long',
      'ui.report.validation.category-required',
      'ui.media.credit.author',
      'ui.media.credit.source',
      'ui.media.credit.license',
      'ui.media.type.model',
      'ui.media.type.image',
      'ui.media.type.narration.vi',
      'ui.media.type.narration.en',
      'ui.media.type.subtitle.vi',
      'ui.media.type.subtitle.en',
      'ui.tour.model.failure.download',
      'ui.tour.model.failure.format',
    ];

    assert.deepEqual(requiredNamespaces.filter((namespace) => !seededNamespaces.has(namespace)), []);
  });
});

