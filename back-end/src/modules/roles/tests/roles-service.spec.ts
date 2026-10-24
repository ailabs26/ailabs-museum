import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { UserRole } from '../../users/entities/user-role.entity';
import { toRoleResponse } from '../dto/role-response.dto';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Role } from '../entities/role.entity';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { RolesRepository } from '../repositories/roles.repository';
import { RolesService } from '../services/roles.service';

const KNOWN_PERMISSIONS = new Set(['room:read', 'room:create', 'exhibit:read']);

interface Harness {
  service: RolesService;
  log: string[];
  roles: Map<string, Role & { permissions: string[] }>;
  setUsage(count: number): void;
}

function harness(): Harness {
  const log: string[] = [];
  let usage = 0;
  let inTx = false;
  const roles = new Map<string, Role & { permissions: string[] }>([
    ['r-admin', { id: 'r-admin', code: 'admin', name: 'Admin', permissions: ['room:read'] } as never],
    ['r-editor', { id: 'r-editor', code: 'editor', name: 'Editor', permissions: ['room:read'] } as never],
    ['r-custom', { id: 'r-custom', code: 'curator', name: 'Curator', permissions: [] } as never],
  ]);
  const withPermissions = (role?: Role & { permissions: string[] }) => role && ({
    ...role,
    rolePermissions: role.permissions.map((code) => ({ permission: { code } })),
  }) as unknown as Role;

  const manager = {
    getRepository: (entity: unknown) => ({
      count: async () => {
        assert.equal(entity, UserRole);
        return usage;
      },
      delete: async (where: Record<string, string>) => {
        const name = entity === RolePermission ? 'role_permissions' : entity === Role ? 'roles' : 'unknown';
        log.push(`delete:${name}:${Object.values(where).join(',')}`);
        if (entity === Role) roles.delete(where.id);
      },
    }),
  } as unknown as EntityManager;

  const rolesRepo = {
    listWithPermissions: async () => [...roles.values()].map((role) => withPermissions(role)!),
    findWithPermissions: async (id: string) => withPermissions(roles.get(id)) ?? null,
    findById: async (id: string) => roles.get(id) ?? null,
    existsByCode: async (code: string) => [...roles.values()].some((role) => role.code === code),
    create: (data: Partial<Role>) => ({ ...data }) as Role,
    save: async (role: Role) => {
      const saved = { ...role, id: 'r-new', permissions: [] } as never;
      roles.set('r-new', saved);
      return saved;
    },
    update: async (id: string, patch: Partial<Role>) => void Object.assign(roles.get(id)!, patch),
    findManyByIds: async (ids: string[]) => ids.map((id) => roles.get(id)).filter(Boolean) as Role[],
  } as unknown as RolesRepository;

  const permissionsRepo = {
    listAll: async () => [...KNOWN_PERMISSIONS].map((code) => ({ code }) as Permission),
    findMissingCodes: async (codes: string[]) => codes.filter((code) => !KNOWN_PERMISSIONS.has(code)),
    setForRole: async (roleId: string, codes: string[], received: EntityManager) => {
      assert.ok(inTx && received === manager, 'setForRole phải chạy trong transaction');
      log.push(`setForRole:${roleId}:${codes.join(',')}`);
      roles.get(roleId)!.permissions = codes;
    },
    lockMatrix: async (received: EntityManager) => {
      assert.ok(inTx && received === manager);
      log.push('lockMatrix');
    },
  } as unknown as PermissionsRepository;

  const tx = {
    run: async <T>(work: (m: EntityManager) => Promise<T>): Promise<T> => {
      // Mô phỏng rollback: thay đổi quyền bị hoàn tác khi work ném lỗi.
      const snapshot = new Map([...roles].map(([id, role]) => [id, [...role.permissions]]));
      inTx = true;
      try {
        return await work(manager);
      } catch (error) {
        for (const [id, permissions] of snapshot) if (roles.has(id)) roles.get(id)!.permissions = permissions;
        log.push('rollback');
        throw error;
      } finally {
        inTx = false;
      }
    },
  } as unknown as TransactionManager;

  return {
    service: new RolesService(rolesRepo, permissionsRepo, tx),
    log,
    roles,
    setUsage: (count) => void (usage = count),
  };
}

describe('RolesService', () => {
  it('list / getById / getPermissions / listAllPermissions', async () => {
    const { service } = harness();
    assert.equal((await service.list()).length, 3);
    assert.deepEqual(await service.getPermissions('r-editor'), ['room:read']);
    assert.equal((await service.getById('r-custom')).code, 'curator');
    assert.equal((await service.listAllPermissions()).length, 3);
    await assert.rejects(service.getById('ghost'), NotFoundException);
  });

  it('create: 409 khi trùng code; thành công trả role mới', async () => {
    const { service } = harness();
    await assert.rejects(service.create({ code: 'editor', name: 'Dup' }), ConflictException);
    assert.equal((await service.create({ code: 'guide', name: 'Guide' })).id, 'r-new');
  });

  it('update: đổi tên, 404 khi không có', async () => {
    const { service } = harness();
    assert.equal((await service.update('r-custom', { name: 'Mới' })).name, 'Mới');
    await assert.rejects(service.update('ghost', { name: 'x' }), NotFoundException);
  });

  it('remove: chặn role hệ thống mặc định', async () => {
    const { service, log } = harness();
    for (const id of ['r-admin', 'r-editor']) await assert.rejects(service.remove(id), ConflictException);
    assert.deepEqual(log, []);
  });

  it('remove: chặn role đang được gán (kiểm trong transaction)', async () => {
    const { service, setUsage, roles } = harness();
    setUsage(1);
    await assert.rejects(service.remove('r-custom'), /đang được gán/);
    assert.ok(roles.has('r-custom'));
  });

  it('remove: xóa liên kết quyền rồi xóa role trong cùng transaction', async () => {
    const { service, log, roles } = harness();
    await service.remove('r-custom');
    assert.deepEqual(log, ['delete:role_permissions:r-custom', 'delete:roles:r-custom']);
    assert.equal(roles.has('r-custom'), false);
  });

  it('setPermissions: khóa ma trận, đặt quyền; chặn role admin và quyền không tồn tại', async () => {
    const { service, log } = harness();
    const result = await service.setPermissions('r-editor', { permissions: ['room:create', 'exhibit:read'] });
    assert.deepEqual(result.permissions, ['exhibit:read', 'room:create']);
    assert.deepEqual(log, ['lockMatrix', 'setForRole:r-editor:room:create,exhibit:read']);
    await assert.rejects(service.setPermissions('r-admin', { permissions: [] }), ConflictException);
    await assert.rejects(service.setPermissions('r-editor', { permissions: ['user:god'] }), UnprocessableEntityException);
  });

  it('setPermissionMatrix: cập nhật nhiều role trong MỘT transaction', async () => {
    const { service, log } = harness();
    const result = await service.setPermissionMatrix({
      updates: [
        { roleId: 'r-editor', permissions: ['exhibit:read'] },
        { roleId: 'r-custom', permissions: ['room:read', 'room:create'] },
      ],
    });
    assert.deepEqual(result.roleIds, ['r-editor', 'r-custom']);
    assert.deepEqual(result.roles.map((role) => role.permissions), [['exhibit:read'], ['room:create', 'room:read']]);
    assert.deepEqual(log, ['lockMatrix', 'setForRole:r-editor:exhibit:read', 'setForRole:r-custom:room:read,room:create']);
  });

  it('setPermissionMatrix: role trùng lặp → 422 trước khi mở transaction', async () => {
    const { service, log } = harness();
    await assert.rejects(
      service.setPermissionMatrix({ updates: [{ roleId: 'r-editor', permissions: [] }, { roleId: 'r-editor', permissions: [] }] }),
      UnprocessableEntityException,
    );
    assert.deepEqual(log, []);
  });

  for (const [label, updates, expected] of [
    ['role không tồn tại', [{ roleId: 'ghost', permissions: [] }], UnprocessableEntityException],
    ['có role admin', [{ roleId: 'r-editor', permissions: [] }, { roleId: 'r-admin', permissions: [] }], ConflictException],
    ['quyền không tồn tại', [{ roleId: 'r-editor', permissions: ['nope:x'] }], UnprocessableEntityException],
  ] as const) {
    it(`setPermissionMatrix: ${label} → rollback, không role nào bị đổi`, async () => {
      const { service, roles, log } = harness();
      const before = [...roles.values()].map((role) => [...role.permissions]);
      await assert.rejects(service.setPermissionMatrix({ updates: updates as never }), expected);
      assert.deepEqual([...roles.values()].map((role) => role.permissions), before);
      assert.equal(log.at(-1), 'rollback');
      assert.equal(log.some((entry) => entry.startsWith('setForRole')), false);
    });
  }

  it('toRoleResponse sắp xếp quyền và bỏ liên kết thiếu permission', () => {
    const response = toRoleResponse({
      id: 'r', code: 'c', name: 'n',
      rolePermissions: [{ permission: { code: 'z:read' } }, { permission: null }, { permission: { code: 'a:read' } }],
    } as unknown as Role);
    assert.deepEqual(response.permissions, ['a:read', 'z:read']);
    assert.deepEqual(toRoleResponse({ id: 'r', code: 'c', name: 'n' } as Role).permissions, []);
  });
});
