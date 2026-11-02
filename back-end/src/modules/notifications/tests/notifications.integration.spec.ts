import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { Permission } from '../../roles/entities/permission.entity';
import { Role } from '../../roles/entities/role.entity';
import { UserStatus, User } from '../../users/entities/user.entity';
import { UsersRepository } from '../../users/repositories/users.repository';
import { Notification, NotificationType } from '../entities/notification.entity';
import { NotificationsRepository } from '../repositories/notifications.repository';

/**
 * Repository thông báo trên PostgreSQL THẬT: tìm người nhận theo quyền và thao tác chỉ trên thông báo của chính mình.
 * Chỉ chạy khi CORE_TEST_DATABASE_URL trỏ localhost; chỉ thêm/xóa dữ liệu mang tiền tố `tag` do test tạo.
 */
const TEST_DATABASE_URL = process.env.CORE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần CORE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

describe('NotificationsRepository (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let repo: NotificationsRepository;
  const tag = `ntest${randomUUID().slice(0, 8)}`;
  const permissionCode = `${tag}:notify`;
  const created = { users: [] as string[], roles: [] as string[], permissions: [] as string[] };

  async function createUser(suffix: string, overrides: Partial<User> = {}): Promise<User> {
    const user = await db.getRepository(User).save({
      email: `${tag}-${suffix}@example.test`, passwordHash: 'x', displayName: suffix, ...overrides,
    });
    created.users.push(user.id);
    return user;
  }

  async function grant(user: User, role: Role): Promise<void> {
    await db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [user.id, role.id]);
  }

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL, ssl: undefined } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    repo = new NotificationsRepository(db.getRepository(Notification));
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.users.length) {
      await db.query('DELETE FROM notifications WHERE user_id = ANY($1)', [created.users]);
      await db.query('DELETE FROM user_roles WHERE user_id = ANY($1)', [created.users]);
      await db.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
    }
    if (created.roles.length) {
      await db.query('DELETE FROM role_permissions WHERE role_id = ANY($1)', [created.roles]);
      await db.query('DELETE FROM roles WHERE id = ANY($1)', [created.roles]);
    }
    if (created.permissions.length) await db.query('DELETE FROM permissions WHERE id = ANY($1)', [created.permissions]);
    await db.destroy();
  });

  it('UsersRepository.findActiveWithPermission (người nhận thông báo / người được giao): chỉ user active, chưa xóa, qua vai trò chưa xóa; không trùng khi có 2 vai trò', async () => {
    const permission = await db.getRepository(Permission).save({ code: permissionCode });
    created.permissions.push(permission.id);
    const [role, role2, deletedRole, otherRole] = await Promise.all(['r1', 'r2', 'r-del', 'r-other'].map(async (s) => {
      const r = await db.getRepository(Role).save({ code: `${tag}-${s}`, name: s, ...(s === 'r-del' ? { isDeleted: true, deletedAt: new Date() } : {}) });
      created.roles.push(r.id);
      return r;
    }));
    for (const r of [role, role2, deletedRole]) {
      await db.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [r.id, permission.id]);
    }

    const ok = await createUser('ok');
    await grant(ok, role);
    await grant(ok, role2);
    const disabled = await createUser('disabled', { status: UserStatus.DISABLED });
    await grant(disabled, role);
    const softDeleted = await createUser('deleted', { isDeleted: true, deletedAt: new Date() });
    await grant(softDeleted, role);
    const viaDeletedRole = await createUser('via-deleted-role');
    await grant(viaDeletedRole, deletedRole);
    const noPermission = await createUser('no-perm');
    await grant(noPermission, otherRole);

    const holders = await new UsersRepository(db.getRepository(User)).findActiveWithPermission(permissionCode);
    assert.deepEqual(holders, [{ id: ok.id, email: ok.email, displayName: ok.displayName }]);
  });

  it('đọc / đọc hết / xóa chỉ tác động thông báo của chính mình; đếm chưa đọc; mới nhất trước', async () => {
    const me = await createUser('me');
    const other = await createUser('other');
    const base = { type: NotificationType.REPORT_CREATED, title: 't' };
    await repo.insertMany([
      { ...base, userId: me.id, title: 'cũ', createdAt: new Date('2026-11-01T00:00:00Z') },
      { ...base, userId: me.id, title: 'mới', createdAt: new Date('2026-11-02T00:00:00Z') },
      { ...base, userId: other.id },
    ]);
    const mine = await repo.listForUser(me.id, 1, 10);
    assert.deepEqual(mine.items.map((n) => n.title), ['mới', 'cũ']);
    assert.equal(mine.total, 2);
    const [theirs] = (await repo.listForUser(other.id, 1, 10)).items;

    assert.equal(await repo.markRead(me.id, theirs.id), false, 'không đọc hộ người khác');
    assert.equal(await repo.deleteOwn(me.id, theirs.id), false, 'không xóa hộ người khác');
    assert.equal(await repo.countUnread(other.id), 1);

    assert.equal(await repo.markRead(me.id, mine.items[0].id), true);
    const firstReadAt = (await db.getRepository(Notification).findOneByOrFail({ id: mine.items[0].id })).readAt;
    assert.ok(firstReadAt);
    assert.equal(await repo.markRead(me.id, mine.items[0].id), true, 'đọc lại vẫn thành công');
    const again = await db.getRepository(Notification).findOneByOrFail({ id: mine.items[0].id });
    assert.equal(again.readAt?.getTime(), firstReadAt.getTime(), 'giữ thời điểm đọc đầu tiên');
    assert.equal(await repo.countUnread(me.id), 1);

    assert.equal(await repo.markAllRead(me.id), 1);
    assert.equal(await repo.countUnread(me.id), 0);
    assert.equal(await repo.countUnread(other.id), 1, 'đọc hết không đụng người khác');

    assert.equal(await repo.deleteOwn(me.id, mine.items[1].id), true);
    assert.equal((await repo.listForUser(me.id, 1, 10)).total, 1);
  });
});
