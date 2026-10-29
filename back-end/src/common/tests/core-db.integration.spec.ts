import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, In } from 'typeorm';
import { dataSource as appDataSource } from '../../config/data-source';
import { RefreshSession } from '../../modules/auth/entities/refresh-session.entity';
import { RefreshSessionsRepository } from '../../modules/auth/repositories/refresh-sessions.repository';
import { AuthService } from '../../modules/auth/services/auth.service';
import { TokenService } from '../../modules/auth/services/token.service';
import { PasswordService } from '../security/password.service';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { PermissionsRepository } from '../../modules/roles/repositories/permissions.repository';
import { RolesRepository } from '../../modules/roles/repositories/roles.repository';
import { RolesService } from '../../modules/roles/services/roles.service';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';
import { AuditRepository } from '../../modules/audit/repositories/audit.repository';
import { AuditService } from '../../modules/audit/services/audit.service';
import { PartnerApiKey } from '../../modules/partner-api-keys/entities/partner-api-key.entity';
import { PartnerApiKeysRepository } from '../../modules/partner-api-keys/repositories/partner-api-keys.repository';
import { PartnerApiKeysService } from '../../modules/partner-api-keys/services/partner-api-keys.service';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { UserRolesRepository } from '../../modules/users/repositories/user-roles.repository';
import { UsersRepository } from '../../modules/users/repositories/users.repository';
import { TransactionManager } from '../database/transaction.manager';

/**
 * Integration test lõi (Transaction + repository + khóa advisory) trên PostgreSQL THẬT.
 * Chỉ chạy khi CORE_TEST_DATABASE_URL trỏ tới database cục bộ (localhost) — không bao giờ chạy
 * trên database dùng chung/Supabase. Test chỉ thêm/xóa bản ghi có tiền tố `tag` do chính nó tạo.
 *
 *   docker run -d --rm --name aura-pg-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aura_test \
 *     -p 55432:5432 postgres:16-alpine
 *   CORE_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/aura_test npm run test:core
 */
const TEST_DATABASE_URL = process.env.CORE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần CORE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Core DB (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let tx: TransactionManager;
  let users: UsersRepository;
  let userRoles: UserRolesRepository;
  let roles: RolesRepository;
  let permissions: PermissionsRepository;
  const tag = `itest${randomUUID().slice(0, 8)}`;
  const created = { users: [] as string[], roles: [] as string[], permissions: [] as string[] };

  async function createUser(suffix: string, overrides: Partial<User> = {}): Promise<User> {
    const user = await db.getRepository(User).save({
      email: `${tag}-${suffix}@example.test`,
      passwordHash: 'not-a-real-hash',
      displayName: `${tag} ${suffix}`,
      ...overrides,
    });
    created.users.push(user.id);
    return user;
  }

  async function createRole(suffix: string): Promise<Role> {
    const role = await db.getRepository(Role).save({ code: `${tag}-${suffix}`, name: `Role ${suffix}` });
    created.roles.push(role.id);
    return role;
  }

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL, ssl: undefined } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    tx = new TransactionManager(db);
    users = new UsersRepository(db.getRepository(User));
    userRoles = new UserRolesRepository(db.getRepository(UserRole), db.getRepository(Role));
    roles = new RolesRepository(db.getRepository(Role));
    permissions = new PermissionsRepository(db.getRepository(Permission), db.getRepository(RolePermission));
    for (const action of ['read', 'write']) {
      const permission = await db.getRepository(Permission).save({ code: `${tag}:${action}` });
      created.permissions.push(permission.id);
    }
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.users.length) {
      await db.query('UPDATE refresh_sessions SET replaced_by_id = NULL WHERE user_id = ANY($1)', [created.users]);
      await db.query('DELETE FROM refresh_sessions WHERE user_id = ANY($1)', [created.users]);
      await db.query('DELETE FROM user_roles WHERE user_id = ANY($1)', [created.users]);
      await db.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
    }
    if (created.roles.length) {
      await db.query('DELETE FROM role_permissions WHERE role_id = ANY($1)', [created.roles]);
      await db.query('DELETE FROM user_roles WHERE role_id = ANY($1)', [created.roles]);
      await db.query('DELETE FROM roles WHERE id = ANY($1)', [created.roles]);
    }
    if (created.permissions.length) await db.query('DELETE FROM permissions WHERE id = ANY($1)', [created.permissions]);
    await db.destroy();
  });

  describe('TransactionManager', () => {
    it('commit: mọi thao tác trong work được lưu', async () => {
      const code = `${tag}-commit`;
      const role = await tx.run(async (manager) => {
        const saved = await manager.getRepository(Role).save({ code, name: 'Commit' });
        await manager.getRepository(RolePermission).save({ roleId: saved.id, permissionId: created.permissions[0] });
        return saved;
      });
      created.roles.push(role.id);
      assert.equal(await db.getRepository(RolePermission).count({ where: { roleId: role.id } }), 1);
    });

    it('rollback: lỗi giữa chừng hủy MỌI thao tác đã ghi trước đó', async () => {
      const code = `${tag}-rollback`;
      await assert.rejects(tx.run(async (manager) => {
        const saved = await manager.getRepository(Role).save({ code, name: 'Rollback' });
        await manager.getRepository(RolePermission).save({ roleId: saved.id, permissionId: created.permissions[0] });
        throw new Error('fail after writes');
      }), /fail after writes/);
      assert.equal(await db.getRepository(Role).count({ where: { code } }), 0);
    });

    it('rollback khi vi phạm ràng buộc DB (unique) ở thao tác sau', async () => {
      const existing = await createRole('unique');
      const code = `${tag}-before-dup`;
      await assert.rejects(tx.run(async (manager) => {
        await manager.getRepository(Role).save({ code, name: 'Before' });
        await manager.getRepository(Role).save({ code: existing.code, name: 'Dup' });
      }));
      assert.equal(await db.getRepository(Role).count({ where: { code } }), 0);
    });

    it('cô lập: dữ liệu chưa commit không nhìn thấy từ kết nối khác', async () => {
      const code = `${tag}-isolation`;
      let seenOutside = -1;
      const role = await tx.run(async (manager) => {
        const saved = await manager.getRepository(Role).save({ code, name: 'Isolation' });
        seenOutside = await db.getRepository(Role).count({ where: { code } });
        return saved;
      });
      created.roles.push(role.id);
      assert.equal(seenOutside, 0);
      assert.equal(await db.getRepository(Role).count({ where: { code } }), 1);
    });

    it('advisory lock quản trị user tuần tự hóa 2 transaction đồng thời', async () => {
      const events: string[] = [];
      const first = tx.run(async (manager) => {
        await users.lockManagement(manager);
        events.push('A:locked');
        await sleep(300);
        events.push('A:commit');
      });
      await sleep(50);
      const second = tx.run(async (manager) => {
        events.push('B:waiting');
        await users.lockManagement(manager);
        events.push('B:locked');
      });
      await Promise.all([first, second]);
      assert.deepEqual(events, ['A:locked', 'B:waiting', 'A:commit', 'B:locked']);
    });

    it('advisory lock ma trận quyền tuần tự hóa 2 transaction đồng thời', async () => {
      const events: string[] = [];
      const first = tx.run(async (manager) => {
        await permissions.lockMatrix(manager);
        events.push('A:locked');
        await sleep(200);
        events.push('A:commit');
      });
      await sleep(50);
      const second = tx.run(async (manager) => {
        await permissions.lockMatrix(manager);
        events.push('B:locked');
      });
      await Promise.all([first, second]);
      assert.deepEqual(events, ['A:locked', 'A:commit', 'B:locked']);
    });
  });

  describe('UsersRepository / UserRolesRepository', () => {
    it('existsByEmail tính cả tài khoản đã xóa mềm; saveNew trùng email (không phân biệt hoa thường) → 409', async () => {
      const deleted = await createUser('deleted', { isDeleted: true, deletedAt: new Date() });
      assert.equal(await users.existsByEmail(deleted.email), true);
      await assert.rejects(
        tx.run((manager) => users.saveNew(users.create({
          email: deleted.email.toUpperCase(),
          passwordHash: 'x',
          displayName: 'Dup',
        }), manager)),
        ConflictException,
      );
    });

    it('findDetail/findByIdWithAccess bỏ qua user đã xóa mềm và nạp đủ quan hệ quyền', async () => {
      const role = await createRole('access');
      await db.getRepository(RolePermission).save({ roleId: role.id, permissionId: created.permissions[1] });
      const user = await createUser('access');
      await userRoles.assign(user.id, role.id);
      const withAccess = await users.findByIdWithAccess(user.id);
      assert.equal(withAccess?.userRoles[0].role.rolePermissions[0].permission.code, `${tag}:write`);
      assert.equal((await users.findByEmailWithAccess(user.email))?.id, user.id);
      assert.equal(await userRoles.has(user.id, role.id), true);

      const gone = await createUser('gone', { isDeleted: true, deletedAt: new Date() });
      assert.equal(await users.findDetail(gone.id), null);
      assert.equal(await users.findActiveById(gone.id), null);
      assert.equal(await users.findByEmailWithAccess(gone.email), null);
    });

    it('listPaginated lọc theo từ khóa + trạng thái, loại user đã xóa', async () => {
      await createUser('list-active');
      await createUser('list-disabled', { status: UserStatus.DISABLED });
      await createUser('list-deleted', { isDeleted: true, deletedAt: new Date() });
      const all = await users.listPaginated({ page: 1, pageSize: 100, q: `${tag}-list` });
      assert.equal(all.total, 2);
      const disabled = await users.listPaginated({ page: 1, pageSize: 100, q: `${tag}-list`, status: UserStatus.DISABLED });
      assert.deepEqual(disabled.items.map((user) => user.status), [UserStatus.DISABLED]);
      const paged = await users.listPaginated({ page: 2, pageSize: 1, q: `${tag}-list` });
      assert.equal(paged.items.length, 1);
      assert.equal(paged.total, 2);
    });

    it('assignMany idempotent, replace thay toàn bộ, findMissingRoleIds/findCodes', async () => {
      const [a, b] = [await createRole('ra'), await createRole('rb')];
      const user = await createUser('roles');
      await tx.run(async (manager) => {
        await userRoles.assignMany(user.id, [a.id, b.id], manager);
        await userRoles.assignMany(user.id, [a.id], manager);
      });
      assert.equal(await db.getRepository(UserRole).count({ where: { userId: user.id } }), 2);
      await tx.run((manager) => userRoles.replace(user.id, [b.id], manager));
      assert.deepEqual((await db.getRepository(UserRole).find({ where: { userId: user.id } })).map((row) => row.roleId), [b.id]);
      await tx.run((manager) => userRoles.remove(user.id, b.id, manager));
      assert.equal(await userRoles.has(user.id, b.id), false);

      const ghost = randomUUID();
      assert.deepEqual(await userRoles.findMissingRoleIds([a.id, ghost]), [ghost]);
      assert.deepEqual(await userRoles.findMissingRoleIds([]), []);
      assert.deepEqual(await tx.run((manager) => userRoles.findCodes([a.id], manager)), [a.code]);
      assert.deepEqual(await tx.run((manager) => userRoles.findCodes([], manager)), []);
    });

    it('countActiveAdmins chỉ đếm user active, chưa xóa, có role admin', async () => {
      const admin = await db.getRepository(Role).findOneByOrFail({ code: 'admin' }).catch(() => null);
      if (!admin) return; // DB chưa seed role admin — kiểm thử này không áp dụng.
      const baseline = await tx.run((manager) => users.countActiveAdmins(manager));
      const active = await createUser('admin-active');
      const disabled = await createUser('admin-disabled', { status: UserStatus.DISABLED });
      for (const user of [active, disabled]) await userRoles.assign(user.id, admin.id);
      assert.equal(await tx.run((manager) => users.countActiveAdmins(manager)), baseline + 1);
    });
  });

  describe('RolesRepository / PermissionsRepository', () => {
    it('setForRole thay toàn bộ quyền; findMissingCodes; findManyByIds; listWithPermissions', async () => {
      const role = await createRole('perm');
      await tx.run((manager) => permissions.setForRole(role.id, [`${tag}:read`, `${tag}:write`], manager));
      assert.deepEqual(
        (await roles.findWithPermissions(role.id))!.rolePermissions.map((link) => link.permission.code).sort(),
        [`${tag}:read`, `${tag}:write`],
      );
      await tx.run((manager) => permissions.setForRole(role.id, [], manager));
      assert.equal(await db.getRepository(RolePermission).count({ where: { roleId: role.id } }), 0);

      assert.deepEqual(await permissions.findMissingCodes([`${tag}:read`, `${tag}:nope`]), [`${tag}:nope`]);
      assert.deepEqual(await permissions.findMissingCodes([]), []);
      assert.ok((await permissions.listAll()).some((permission) => permission.code === `${tag}:read`));
      assert.equal(await roles.existsByCode(role.code), true);
      assert.equal((await roles.findByCode(role.code))?.id, role.id);
      assert.deepEqual((await tx.run((manager) => roles.findManyByIds([role.id, randomUUID()], manager))).map((r) => r.id), [role.id]);
      assert.deepEqual(await tx.run((manager) => roles.findManyByIds([], manager)), []);
      assert.ok((await roles.listWithPermissions()).some((item) => item.id === role.id));
    });
  });

  describe('Vai trò xóa mềm (migration SoftDeleteRoles)', () => {
    let rolesService: RolesService;
    before(() => {
      rolesService = new RolesService(roles, permissions, tx);
    });

    it('migration: có cột is_deleted/deleted_at, CHECK và unique code chỉ cho vai trò chưa xóa', async () => {
      const [row] = await db.query(`SELECT
        (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'roles' AND column_name IN ('is_deleted', 'deleted_at')) AS cols,
        (SELECT indexdef FROM pg_indexes WHERE indexname = 'UQ_roles_code_active') AS idx,
        (SELECT count(*)::int FROM pg_constraint WHERE conname = 'CHK_roles_deleted') AS chk`);
      assert.equal(row.cols, 2);
      assert.equal(row.chk, 1);
      assert.match(row.idx, /UNIQUE INDEX .* WHERE \(is_deleted = false\)/);
    });

    it('xóa mềm: không còn ở danh sách/ma trận/tìm theo code, không gán được; tạo lại cùng mã được; quyền cũ giữ để truy vết', async () => {
      const code = `${tag}-soft`;
      const role = await createRole('soft');
      await db.getRepository(RolePermission).save({ roleId: role.id, permissionId: created.permissions[0] });
      await rolesService.remove(role.id);

      const stored = await db.getRepository(Role).findOneByOrFail({ id: role.id });
      assert.equal(stored.isDeleted, true);
      assert.ok(stored.deletedAt);
      assert.equal(await db.getRepository(RolePermission).count({ where: { roleId: role.id } }), 1);
      assert.equal((await roles.listWithPermissions()).some((item) => item.id === role.id), false);
      assert.equal(await roles.findById(role.id), null);
      assert.equal(await roles.findByCode(code), null);
      assert.deepEqual(await tx.run((manager) => roles.findManyByIds([role.id], manager)), []);
      assert.deepEqual(await userRoles.findMissingRoleIds([role.id]), [role.id]);

      const again = await rolesService.create({ code, name: 'Tạo lại' });
      created.roles.push(again.id);
      assert.notEqual(again.id, role.id);
      await assert.rejects(rolesService.create({ code, name: 'Trùng' }), ConflictException);
    });

    it('xóa hàng loạt tất cả hoặc không: 1 vai trò đang gán → không vai trò nào bị xóa; hết vướng thì xóa cả', async () => {
      const free = await createRole('bulk-free');
      const used = await createRole('bulk-used');
      const user = await createUser('bulk-role-user');
      await db.getRepository(UserRole).save({ userId: user.id, roleId: used.id });

      await assert.rejects(rolesService.removeMany([free.id, used.id]), ConflictException);
      const after = await db.getRepository(Role).findBy({ id: In([free.id, used.id]) });
      assert.ok(after.every((item) => !item.isDeleted), 'không vai trò nào bị xóa');

      // User đã xóa mềm vẫn giữ dòng user_roles nhưng không còn tính là "đang gán".
      await db.getRepository(User).update(user.id, { isDeleted: true, deletedAt: new Date() });
      assert.deepEqual(await rolesService.removeMany([free.id, used.id]), { ids: [free.id, used.id] });
      const done = await db.getRepository(Role).findBy({ id: In([free.id, used.id]) });
      assert.ok(done.every((item) => item.isDeleted));
    });
  });

  describe('Audit (SQL thật)', () => {
    it('lưu sự kiện không gắn tài nguyên (resource_id NULL) kèm IP/User-Agent; API không lộ passwordHash của actor', async () => {
      const service = new AuditService(new AuditRepository(db.getRepository(AuditLog)));
      const actor = await createUser('audit-actor');
      const requestId = `${tag}-audit`;
      try {
        await service.record({ actorId: null, action: 'auth.login_failed', resourceType: 'user', resourceId: null, requestId, ip: '203.0.113.7', userAgent: 'UA-test' });
        await service.record({ actorId: actor.id, action: 'auth.login', resourceType: 'user', resourceId: actor.id, requestId, ip: '203.0.113.7', userAgent: 'UA-test' });
        const rows = await db.getRepository(AuditLog).find({ where: { requestId }, order: { occurredAt: 'ASC' } });
        assert.deepEqual(rows.map((row) => [row.action, row.resourceId, row.ip, row.userAgent]), [
          ['auth.login_failed', null, '203.0.113.7', 'UA-test'],
          ['auth.login', actor.id, '203.0.113.7', 'UA-test'],
        ]);
        const page = await service.list({ page: 1, pageSize: 50, action: 'auth.login' } as never);
        const mine = page.items.find((item) => item.requestId === requestId)!;
        assert.deepEqual(mine.actor, { id: actor.id, email: actor.email, displayName: actor.displayName });
        assert.equal(JSON.stringify(page).includes('passwordHash'), false);
        assert.equal(JSON.stringify(await service.getById(mine.id)).includes('not-a-real-hash'), false);
      } finally {
        await db.query('DELETE FROM audit_logs WHERE request_id = $1', [requestId]);
      }
    });
  });

  describe('API key đối tác (SQL thật)', () => {
    it('authenticate chỉ nhận key active, chưa xóa, chưa hết hạn; xóa mềm giữ bản ghi và ẩn khỏi danh sách', async () => {
      const service = new PartnerApiKeysService(new PartnerApiKeysRepository(db.getRepository(PartnerApiKey)));
      const created: string[] = [];
      try {
        const make = async (extra: { expiresInDays?: number } = {}) => {
          const key = await service.create({ partnerName: `${tag}-partner`, scopes: ['rooms:read'], ...extra });
          created.push(key.id);
          return key;
        };
        const live = await make({ expiresInDays: 30 });
        const noExpiry = await make();
        const revoked = await make();
        const expired = await make({ expiresInDays: 1 });
        const deleted = await make();
        await service.revoke(revoked.id);
        await db.getRepository(PartnerApiKey).update(expired.id, { expiresAt: new Date(Date.now() - 1000) });
        await service.remove(deleted.id);

        assert.equal((await service.authenticate(live.plaintext))?.id, live.id);
        assert.equal((await service.authenticate(noExpiry.plaintext))?.id, noExpiry.id);
        for (const blocked of [revoked, expired, deleted]) assert.equal(await service.authenticate(blocked.plaintext), null);
        assert.equal(await service.authenticate(`${live.plaintext}x`), null);

        const row = await db.getRepository(PartnerApiKey).findOneByOrFail({ id: deleted.id });
        assert.equal(row.isDeleted, true);
        assert.equal(row.status, 'revoked');
        assert.equal((await service.list()).some((key) => key.id === deleted.id), false);
        assert.equal(row.rateLimitPerMinute, 60);
      } finally {
        await db.getRepository(PartnerApiKey).delete(created);
      }
    });
  });

  describe('TokenService + RefreshSessionsRepository', () => {
    let service: TokenService;
    let userId: string;

    before(async () => {
      const config = {
        getOrThrow: (key: string) => ({
          'jwt.accessSecret': 'core-db-integration-secret-012345',
          'jwt.accessTtl': '5m',
          'jwt.refreshTtlDays': 1,
        })[key],
      } as unknown as ConfigService;
      service = new TokenService(
        new JwtService(),
        config,
        new RefreshSessionsRepository(db.getRepository(RefreshSession)),
        users,
        tx,
      );
      userId = (await createUser('token')).id;
    });

    it('xoay vòng lưu chuỗi replaced_by_id và chỉ lưu hash', async () => {
      const issued = await service.issueRefresh(userId);
      const rotated = await service.rotate(issued.raw);
      const old = await db.getRepository(RefreshSession).findOneByOrFail({ id: issued.session.id });
      assert.equal(old.replacedById, rotated.session.id);
      assert.ok(old.usedAt);
      const raw = await db.query('SELECT count(*)::int AS n FROM refresh_sessions WHERE token_hash = $1', [issued.raw]);
      assert.equal(raw[0].n, 0, 'raw token không được lưu trong DB');
    });

    it('2 request refresh đồng thời cùng 1 token: đúng 1 thành công, reuse → thu hồi cả family', async () => {
      const issued = await service.issueRefresh(userId);
      const results = await Promise.allSettled([service.rotate(issued.raw), service.rotate(issued.raw)]);
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.ok(rejected[0].reason instanceof UnauthorizedException);
      const family = await db.getRepository(RefreshSession).find({ where: { familyId: issued.session.familyId } });
      assert.equal(family.length, 2);
      assert.ok(family.every((session) => session.revokedAt), 'mọi session trong family phải bị thu hồi');
    });

    it('revoke do hết hạn được commit dù request trả 401', async () => {
      const issued = await service.issueRefresh(userId);
      await db.getRepository(RefreshSession).update(issued.session.id, { expiresAt: new Date(Date.now() - 1000) });
      await assert.rejects(service.rotate(issued.raw), UnauthorizedException);
      const row = await db.getRepository(RefreshSession).findOneByOrFail({ id: issued.session.id });
      assert.ok(row.revokedAt);
    });

    it('revokeAllForUser thu hồi mọi thiết bị của user, không đụng user khác', async () => {
      const sessions = new RefreshSessionsRepository(db.getRepository(RefreshSession));
      const otherId = (await createUser('token-other')).id;
      const laptop = await service.issueRefresh(userId);
      const phone = await service.issueRefresh(userId);
      const other = await service.issueRefresh(otherId);
      await tx.run((manager) => sessions.revokeAllForUser(userId, manager));
      await assert.rejects(service.rotate(laptop.raw), UnauthorizedException);
      await assert.rejects(service.rotate(phone.raw), UnauthorizedException);
      await service.rotate(other.raw);
    });

    it('refresh đang chạy song song với revokeAllForUser: token vừa xoay vòng cũng bị thu hồi', async () => {
      const sessions = new RefreshSessionsRepository(db.getRepository(RefreshSession));
      for (let round = 0; round < 5; round++) {
        const issued = await service.issueRefresh(userId);
        const [rotation] = await Promise.allSettled([
          service.rotate(issued.raw),
          tx.run((manager) => sessions.revokeAllForUser(userId, manager)),
        ]);
        if (rotation.status === 'fulfilled') {
          await assert.rejects(service.rotate(rotation.value.raw), UnauthorizedException);
        }
        const alive = await db.query(
          'SELECT count(*)::int AS n FROM refresh_sessions WHERE user_id = $1 AND revoked_at IS NULL',
          [userId],
        );
        assert.equal(alive[0].n, 0, `vòng ${round}: không session nào của user còn sống`);
      }
    });

    it('migration tạo index partial cho ActiveSessionGuard', async () => {
      const rows = await db.query(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'refresh_sessions' AND indexname = 'IDX_refresh_sessions_family_live'`,
      );
      assert.equal(rows.length, 1);
      assert.match(rows[0].indexdef, /WHERE \(revoked_at IS NULL\)/);
    });

    it('listLiveForUser: 1 dòng/thiết bị (token đầu), giữ signedInAt, UA/IP mới nhất; isFamilyLive qua xoay vòng', async () => {
      const sessions = new RefreshSessionsRepository(db.getRepository(RefreshSession));
      const deviceUser = (await createUser('devices')).id;
      const laptop = await service.issueRefresh(deviceUser, undefined, undefined, { userAgent: 'Laptop', ip: '10.0.0.1' });
      const phone = await service.issueRefresh(deviceUser, undefined, undefined, { userAgent: 'Phone', ip: '10.0.0.2' });
      const rotated = await service.rotate(laptop.raw, { userAgent: 'Laptop v2', ip: '10.0.0.3' });

      const live = await sessions.listLiveForUser(deviceUser);
      assert.deepEqual(live.map((row) => row.familyId).sort(), [laptop.session.familyId, phone.session.familyId].sort());
      const laptopRow = live.find((row) => row.familyId === laptop.session.familyId)!;
      assert.equal(laptopRow.id, rotated.session.id, 'chỉ trả token đầu của family');
      assert.equal(laptopRow.userAgent, 'Laptop v2');
      assert.equal(laptopRow.ip, '10.0.0.3');
      assert.equal(laptopRow.signedInAt.getTime(), laptop.session.signedInAt.getTime());
      assert.equal(await sessions.isFamilyLive(laptop.session.familyId), true, 'xoay vòng không làm family chết');
    });

    it('revokeAllForUser(except) giữ phiên hiện tại; revokeFamilyOfUser không thu hồi được phiên người khác', async () => {
      const sessions = new RefreshSessionsRepository(db.getRepository(RefreshSession));
      const owner = (await createUser('owner')).id;
      const intruder = (await createUser('intruder')).id;
      const current = await service.issueRefresh(owner);
      const other = await service.issueRefresh(owner);
      const foreign = await service.issueRefresh(intruder);

      assert.equal(await tx.run((manager) => sessions.revokeFamilyOfUser(owner, foreign.session.familyId, manager)), false);
      assert.equal(await sessions.isFamilyLive(foreign.session.familyId), true);

      await tx.run((manager) => sessions.revokeAllForUser(owner, manager, current.session.familyId));
      assert.equal(await sessions.isFamilyLive(current.session.familyId), true);
      assert.equal(await sessions.isFamilyLive(other.session.familyId), false);

      assert.equal(await tx.run((manager) => sessions.revokeFamilyOfUser(owner, current.session.familyId, manager)), true);
      assert.equal(await sessions.isFamilyLive(current.session.familyId), false);
      assert.equal(await tx.run((manager) => sessions.revokeFamilyOfUser(owner, current.session.familyId, manager)), false, 'đã thu hồi rồi');
    });

    it('tự đổi mật khẩu: hash mới được lưu, thiết bị khác bị thu hồi, thiết bị hiện tại giữ; đăng nhập lại bằng mật khẩu mới', async () => {
      const sessions = new RefreshSessionsRepository(db.getRepository(RefreshSession));
      const passwords = new PasswordService({ getOrThrow: () => 4 } as unknown as ConfigService);
      const auth = new AuthService(users, passwords, service, tx, sessions);
      const owner = await createUser('change-pw', { passwordHash: await passwords.hash('Old-Passw0rd') });
      const current = await service.issueRefresh(owner.id);
      const other = await service.issueRefresh(owner.id);
      const actor = { id: owner.id, email: owner.email, displayName: owner.displayName, roles: [], permissions: [], sessionId: current.session.familyId };

      await auth.changePassword(actor, { currentPassword: 'Old-Passw0rd', newPassword: 'New-Passw0rd' });

      assert.equal(await sessions.isFamilyLive(current.session.familyId), true);
      assert.equal(await sessions.isFamilyLive(other.session.familyId), false);
      const login = await auth.login({ email: owner.email, password: 'New-Passw0rd' });
      assert.ok(login.accessToken);
      await assert.rejects(auth.login({ email: owner.email, password: 'Old-Passw0rd' }), UnauthorizedException);
    });

    it('logout (revokeByRaw) thu hồi cả token kế tiếp trong family', async () => {
      const issued = await service.issueRefresh(userId);
      const rotated = await service.rotate(issued.raw);
      await service.revokeByRaw(issued.raw);
      await assert.rejects(service.rotate(rotated.raw), UnauthorizedException);
    });
  });
});
