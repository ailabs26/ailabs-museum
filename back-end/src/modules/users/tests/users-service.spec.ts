import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { PermissionDeniedException } from '../../../common/exceptions/permission-denied.exception';
import { PasswordService } from '../../../common/security/password.service';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { toUserResponse } from '../dto/user-response.dto';
import { User, UserStatus } from '../entities/user.entity';
import { UserRolesRepository } from '../repositories/user-roles.repository';
import { UsersRepository } from '../repositories/users.repository';
import { RefreshSessionsRepository } from '../../auth/repositories/refresh-sessions.repository';
import { UsersService } from '../services/users.service';
import { toAuthUser } from '../user-access.util';

const ADMIN_ROLE = { id: 'r-admin', code: 'admin' };
const EDITOR_ROLE = { id: 'r-editor', code: 'editor' };
const ROLES = new Map([ADMIN_ROLE, EDITOR_ROLE].map((role) => [role.id, role]));
const MANAGER = { tag: 'tx' } as unknown as EntityManager;

const ACTOR: AuthUser = {
  id: 'actor', email: 'a@aura.local', displayName: 'A', roles: ['admin'],
  permissions: [PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE, PERMISSIONS.ROLE_ASSIGN],
};
const ACTOR_WITHOUT_ASSIGN: AuthUser = { ...ACTOR, permissions: [PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE] };

function makeUser(id: string, roleIds: string[], status = UserStatus.ACTIVE): User {
  return {
    id,
    email: `${id}@aura.local`,
    displayName: id,
    passwordHash: 'secret-hash',
    status,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    userRoles: roleIds.map((roleId) => ({ roleId, role: ROLES.get(roleId) })),
  } as unknown as User;
}

interface Harness {
  service: UsersService;
  log: string[];
  users: Map<string, User>;
  setActiveAdmins(count: number): void;
}

function harness(initial: User[] = [], options: { emailTaken?: boolean } = {}): Harness {
  const log: string[] = [];
  const users = new Map(initial.map((user) => [user.id, user]));
  let activeAdmins = 1;
  let inTx = false;
  const scope = (manager?: EntityManager) => (manager === MANAGER ? 'tx' : 'no-tx');

  const usersRepo = {
    listPaginated: async () => ({ items: [...users.values()], total: users.size, page: 1, pageSize: 20 }),
    findDetail: async (id: string, manager?: EntityManager) => {
      log.push(`findDetail:${scope(manager)}`);
      return users.get(id) ?? null;
    },
    existsByEmail: async () => options.emailTaken ?? false,
    lockManagement: async (manager: EntityManager) => {
      assert.ok(inTx && manager === MANAGER, 'lockManagement phải chạy trong transaction');
      log.push('lock');
    },
    create: (data: Partial<User>) => ({ ...data }) as User,
    saveNew: async (user: User, manager: EntityManager) => {
      log.push(`saveNew:${scope(manager)}`);
      const saved = { ...user, id: 'new-user', status: UserStatus.ACTIVE, userRoles: [] } as unknown as User;
      users.set(saved.id, saved);
      return saved;
    },
    update: async (id: string, patch: Partial<User>, manager?: EntityManager) => {
      log.push(`update:${scope(manager)}:${Object.keys(patch).sort().join(',')}`);
      Object.assign(users.get(id)!, patch);
    },
    countActiveAdmins: async () => activeAdmins,
  } as unknown as UsersRepository;

  const setRoleRows = (userId: string, roleIds: string[]) => {
    users.get(userId)!.userRoles = roleIds.map((roleId) => ({ roleId, role: ROLES.get(roleId) })) as never;
  };
  const userRolesRepo = {
    findMissingRoleIds: async (ids: string[]) => ids.filter((id) => !ROLES.has(id)),
    findCodes: async (ids: string[]) => ids.map((id) => ROLES.get(id)!.code),
    assignMany: async (userId: string, ids: string[], manager: EntityManager) => {
      log.push(`assignMany:${scope(manager)}:${ids.join(',')}`);
      const current = (users.get(userId)!.userRoles ?? []).map((row) => row.roleId);
      setRoleRows(userId, [...new Set([...current, ...ids])]);
    },
    replace: async (userId: string, ids: string[], manager: EntityManager) => {
      log.push(`replace:${scope(manager)}:${ids.join(',')}`);
      setRoleRows(userId, ids);
    },
    remove: async (userId: string, roleId: string, manager: EntityManager) => {
      log.push(`remove:${scope(manager)}:${roleId}`);
      setRoleRows(userId, (users.get(userId)!.userRoles ?? []).map((row) => row.roleId).filter((id) => id !== roleId));
    },
  } as unknown as UserRolesRepository;

  const sessions = {
    revokeAllForUser: async (userId: string, manager: EntityManager) => {
      assert.ok(inTx && manager === MANAGER, 'thu hồi phiên phải chạy trong transaction');
      log.push(`revokeSessions:${userId}`);
    },
  } as unknown as RefreshSessionsRepository;

  const passwords = { hash: async (plain: string) => `hashed(${plain})` } as unknown as PasswordService;
  const tx = {
    run: async <T>(work: (manager: EntityManager) => Promise<T>) => {
      inTx = true;
      try {
        return await work(MANAGER);
      } finally {
        inTx = false;
      }
    },
  } as unknown as TransactionManager;

  return {
    service: new UsersService(usersRepo, userRolesRepo, passwords, tx, sessions),
    log,
    users,
    setActiveAdmins: (count) => void (activeAdmins = count),
  };
}

describe('UsersService', () => {
  it('list/getById không bao giờ trả passwordHash', async () => {
    const { service } = harness([makeUser('u1', ['r-editor'])]);
    const list = await service.list({ page: 1, pageSize: 20 } as never);
    const detail = await service.getById('u1');
    for (const item of [...list.items, detail]) {
      assert.equal('passwordHash' in item, false);
      assert.deepEqual(item.roles, ['editor']);
    }
  });

  it('getById: 404 khi không tồn tại', async () => {
    await assert.rejects(harness().service.getById('nope'), NotFoundException);
  });

  it('create: hash mật khẩu, khóa quản trị, lưu user + role trong CÙNG transaction', async () => {
    const { service, log, users } = harness();
    const created = await service.create(
      { email: 'new@aura.local', password: 'Passw0rd!', displayName: 'New', roleIds: ['r-editor'] },
      ACTOR,
    );
    assert.deepEqual(created.roles, ['editor']);
    assert.equal(users.get('new-user')!.passwordHash, 'hashed(Passw0rd!)');
    assert.deepEqual(log, ['lock', 'saveNew:tx', 'assignMany:tx:r-editor', 'findDetail:tx']);
  });

  it('create: email đã dùng (kể cả user đã xóa mềm) → 409', async () => {
    await assert.rejects(
      harness([], { emailTaken: true }).service.create({ email: 'x@y.z', password: 'Passw0rd!', displayName: 'X' }, ACTOR),
      ConflictException,
    );
  });

  it('create kèm roleIds khi actor thiếu role:assign → 403, không ghi gì', async () => {
    const { service, log } = harness();
    await assert.rejects(
      service.create({ email: 'x@y.z', password: 'Passw0rd!', displayName: 'X', roleIds: ['r-editor'] }, ACTOR_WITHOUT_ASSIGN),
      (error: unknown) => error instanceof PermissionDeniedException
        && error.missingPermissions.includes(PERMISSIONS.ROLE_ASSIGN),
    );
    assert.deepEqual(log, []);
  });

  it('create không kèm role vẫn cho phép actor thiếu role:assign', async () => {
    const created = await harness().service.create(
      { email: 'x@y.z', password: 'Passw0rd!', displayName: 'X' },
      ACTOR_WITHOUT_ASSIGN,
    );
    assert.deepEqual(created.roles, []);
  });

  it('create: roleId không tồn tại → 422', async () => {
    await assert.rejects(
      harness().service.create({ email: 'x@y.z', password: 'Passw0rd!', displayName: 'X', roleIds: ['ghost'] }, ACTOR),
      UnprocessableEntityException,
    );
  });

  it('update: đổi tên/trạng thái/mật khẩu trong transaction', async () => {
    const { service, log, users } = harness([makeUser('u1', ['r-editor'])]);
    const result = await service.update('u1', { displayName: 'Mới', status: UserStatus.DISABLED, password: 'NewPassw0rd' }, ACTOR);
    assert.equal(result.displayName, 'Mới');
    assert.equal(users.get('u1')!.passwordHash, 'hashed(NewPassw0rd)');
    assert.ok(log.includes('update:tx:displayName,passwordHash,status'));
  });

  it('update không đổi gì thì không gọi update', async () => {
    const { service, log } = harness([makeUser('u1', ['r-editor'])]);
    await service.update('u1', {}, ACTOR);
    assert.equal(log.some((entry) => entry.startsWith('update')), false);
  });

  it('update roleIds cần role:assign và thay toàn bộ role', async () => {
    const { service, log } = harness([makeUser('u1', ['r-editor'])]);
    await assert.rejects(service.update('u1', { roleIds: [] }, ACTOR_WITHOUT_ASSIGN), PermissionDeniedException);
    const result = await service.update('u1', { roleIds: ['r-admin'] }, ACTOR);
    assert.deepEqual(result.roles, ['admin']);
    assert.ok(log.includes('replace:tx:r-admin'));
  });

  describe('thu hồi phiên khi đổi thông tin đăng nhập', () => {
    const revoked = (log: string[]) => log.filter((entry) => entry.startsWith('revokeSessions:'));

    it('đổi mật khẩu → thu hồi mọi phiên của user, sau khi ghi hash mới', async () => {
      const { service, log } = harness([makeUser('u1', ['r-editor'])]);
      await service.update('u1', { password: 'NewPassw0rd' }, ACTOR);
      assert.deepEqual(revoked(log), ['revokeSessions:u1']);
      assert.ok(log.indexOf('update:tx:passwordHash') < log.indexOf('revokeSessions:u1'));
    });

    it('khóa user → thu hồi mọi phiên', async () => {
      const { service, log } = harness([makeUser('u1', ['r-editor'])]);
      await service.update('u1', { status: UserStatus.DISABLED }, ACTOR);
      assert.deepEqual(revoked(log), ['revokeSessions:u1']);
    });

    it('xóa mềm user → thu hồi mọi phiên', async () => {
      const { service, log, setActiveAdmins } = harness([makeUser('u1', ['r-editor'])]);
      setActiveAdmins(2);
      await service.remove('u1');
      assert.deepEqual(revoked(log), ['revokeSessions:u1']);
    });

    it('đổi tên, mở khóa, đổi role → KHÔNG đăng xuất user', async () => {
      const { service, log } = harness([makeUser('u1', ['r-editor'], UserStatus.DISABLED)]);
      await service.update('u1', { displayName: 'X', status: UserStatus.ACTIVE, roleIds: ['r-editor'] }, ACTOR);
      assert.deepEqual(revoked(log), []);
    });

    it('bị chặn vì Admin cuối → không thu hồi gì', async () => {
      const { service, log } = harness([makeUser('admin', ['r-admin'])]);
      await assert.rejects(service.update('admin', { status: UserStatus.DISABLED }, ACTOR), ConflictException);
      await assert.rejects(service.remove('admin'), ConflictException);
      assert.deepEqual(revoked(log), []);
    });
  });

  describe('bảo vệ Admin hoạt động cuối cùng', () => {
    const lastAdmin = () => harness([makeUser('admin', ['r-admin'])]);

    it('không khóa được Admin cuối', async () => {
      await assert.rejects(lastAdmin().service.update('admin', { status: UserStatus.DISABLED }, ACTOR), ConflictException);
    });

    it('không bỏ role admin của Admin cuối qua update/setRoles/removeRole', async () => {
      await assert.rejects(lastAdmin().service.update('admin', { roleIds: ['r-editor'] }, ACTOR), ConflictException);
      await assert.rejects(lastAdmin().service.setRoles('admin', []), ConflictException);
      await assert.rejects(lastAdmin().service.removeRole('admin', 'r-admin'), ConflictException);
    });

    it('không xóa mềm được Admin cuối', async () => {
      const { service, log } = lastAdmin();
      await assert.rejects(service.remove('admin'), ConflictException);
      assert.equal(log.some((entry) => entry.startsWith('update')), false);
    });

    it('cho phép khi còn Admin hoạt động khác', async () => {
      const { service, setActiveAdmins, users } = lastAdmin();
      setActiveAdmins(2);
      await service.remove('admin');
      assert.equal(users.get('admin')!.isDeleted, true);
      assert.ok(users.get('admin')!.deletedAt instanceof Date);
    });

    it('Admin đã bị khóa thì không bị chặn', async () => {
      const { service } = harness([makeUser('admin', ['r-admin'], UserStatus.DISABLED)]);
      await service.setRoles('admin', []);
    });
  });

  it('assignRoles thêm role (không trùng), 404/422 khi sai', async () => {
    const { service, log } = harness([makeUser('u1', ['r-editor'])]);
    const result = await service.assignRoles('u1', ['r-admin']);
    assert.deepEqual(result.roles.sort(), ['admin', 'editor']);
    assert.ok(log.includes('assignMany:tx:r-admin'));
    await assert.rejects(service.assignRoles('ghost', ['r-admin']), NotFoundException);
    await assert.rejects(service.assignRoles('u1', ['ghost']), UnprocessableEntityException);
  });

  it('setRoles thay toàn bộ role của user thường', async () => {
    const { service, log } = harness([makeUser('u1', ['r-editor'])]);
    assert.deepEqual((await service.setRoles('u1', ['r-editor'])).roles, ['editor']);
    assert.ok(log.includes('replace:tx:r-editor'));
  });

  it('removeRole bỏ role admin khi vẫn còn Admin khác', async () => {
    const { service, setActiveAdmins, log } = harness([makeUser('u1', ['r-editor', 'r-admin'])]);
    setActiveAdmins(2);
    assert.deepEqual((await service.removeRole('u1', 'r-admin')).roles, ['editor']);
    assert.ok(log.includes('remove:tx:r-admin'));
  });
});

describe('toAuthUser / toUserResponse', () => {
  it('gộp permission trùng giữa các role, bỏ role/permission thiếu quan hệ', () => {
    const user = {
      id: 'u', email: 'e', displayName: 'd',
      userRoles: [
        { role: { code: 'a', rolePermissions: [{ permission: { code: 'x:read' } }, { permission: null }] } },
        { role: { code: 'b', rolePermissions: [{ permission: { code: 'x:read' } }, { permission: { code: 'y:read' } }] } },
        { role: null },
        { role: { code: 'c' } },
      ],
    } as unknown as User;
    assert.deepEqual(toAuthUser(user), {
      id: 'u', email: 'e', displayName: 'd', roles: ['a', 'b', 'c'], permissions: ['x:read', 'y:read'],
    });
    assert.deepEqual(toAuthUser({ id: 'u', email: 'e', displayName: 'd' } as User).roles, []);
  });

  it('toUserResponse loại passwordHash và role thiếu', () => {
    const response = toUserResponse({
      ...makeUser('u', ['r-admin']),
      userRoles: [{ role: { code: 'admin' } }, { role: null }],
    } as unknown as User);
    assert.deepEqual(response.roles, ['admin']);
    assert.equal('passwordHash' in response, false);
    assert.deepEqual(toUserResponse({ ...makeUser('u', []), userRoles: undefined } as unknown as User).roles, []);
  });
});
