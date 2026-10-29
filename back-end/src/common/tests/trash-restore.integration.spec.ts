import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { dataSource as appDataSource } from '../../config/data-source';
import { TransactionManager } from '../database/transaction.manager';
import { PasswordService } from '../security/password.service';
import { RefreshSession } from '../../modules/auth/entities/refresh-session.entity';
import { RefreshSessionsRepository } from '../../modules/auth/repositories/refresh-sessions.repository';
import { Exhibit, ExhibitVisibility } from '../../modules/exhibits/entities/exhibit.entity';
import { ExhibitRevision } from '../../modules/exhibits/entities/exhibit-revision.entity';
import { Hotspot } from '../../modules/exhibits/entities/hotspot.entity';
import { ExhibitsRepository } from '../../modules/exhibits/repositories/exhibits.repository';
import { ExhibitsService } from '../../modules/exhibits/services/exhibits.service';
import { RevisionPublishGate } from '../../modules/exhibits/services/revision-publish.gate';
import { Media, MediaKind, MediaProcessingState } from '../../modules/media/entities/media.entity';
import { MediaRepository } from '../../modules/media/repositories/media.repository';
import { MediaInspectionService } from '../../modules/media/services/media-inspection.service';
import { MediaReferenceValidator } from '../../modules/media/services/media-reference.validator';
import { MediaStorageService } from '../../modules/media/services/media-storage.service';
import { MediaService } from '../../modules/media/services/media.service';
import { LocalStorageDriver } from '../../modules/media/storage/local-storage.driver';
import { testMediaUrlService } from '../../modules/media/tests/media-test-doubles';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { PermissionsRepository } from '../../modules/roles/repositories/permissions.repository';
import { RolesRepository } from '../../modules/roles/repositories/roles.repository';
import { RolesService } from '../../modules/roles/services/roles.service';
import { Room } from '../../modules/rooms/entities/room.entity';
import { RoomsRepository } from '../../modules/rooms/repositories/rooms.repository';
import { RoomsService } from '../../modules/rooms/services/rooms.service';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { User } from '../../modules/users/entities/user.entity';
import { UserRolesRepository } from '../../modules/users/repositories/user-roles.repository';
import { UsersRepository } from '../../modules/users/repositories/users.repository';
import { UsersService } from '../../modules/users/services/users.service';
import { toAuthUser } from '../../modules/users/user-access.util';

/**
 * Thùng rác & khôi phục trên PostgreSQL THẬT cho 5 trang quản trị.
 * Chỉ chạy khi CORE_TEST_DATABASE_URL trỏ tới database cục bộ (localhost) — không bao giờ chạy
 * trên DB dùng chung.
 */
const TEST_DATABASE_URL = process.env.CORE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần CORE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

/** 409 khôi phục hàng loạt: trả danh sách [ID, lý do] để so khớp. */
function restoreErrors(error: unknown): Array<[string, string]> {
  assert.ok(error instanceof ConflictException, `cần ConflictException, nhận ${String(error)}`);
  const body = error.getResponse() as { message: string; errors: Array<{ code: string; field: string; message: string }> };
  assert.match(body.message, /Không khôi phục được \d+ mục đã chọn\. Không mục nào được khôi phục\./);
  assert.ok(body.errors.every((item) => item.code === 'restore_blocked'));
  return body.errors.map((item) => [item.field, item.message]);
}

describe('Thùng rác & khôi phục (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let workDir: string;
  let usersService: UsersService;
  let rolesService: RolesService;
  let roomsService: RoomsService;
  let mediaService: MediaService;
  let exhibitsService: ExhibitsService;
  const tag = `trash-${randomUUID().slice(0, 8)}`;
  const created = {
    users: [] as string[], roles: [] as string[], permissions: [] as string[],
    rooms: [] as string[], media: [] as string[], exhibits: [] as string[],
  };
  // DB test chỉ chạy migration (không seed): tạo quyền riêng cho test.
  const READ = `${tag}:read`;
  const DELETE = `${tag}:delete`;
  const deletedAt = new Date('2026-10-01T00:00:00Z');

  async function createUser(deleted: boolean, label = 'u'): Promise<User> {
    const user = await db.getRepository(User).save({
      email: `${tag}-${label}-${randomUUID().slice(0, 6)}@example.test`,
      passwordHash: 'not-a-real-hash',
      displayName: `Người dùng ${label}`,
      isDeleted: deleted,
      deletedAt: deleted ? deletedAt : null,
    });
    created.users.push(user.id);
    return user;
  }

  async function createRole(code: string, deleted: boolean, permissionCodes: string[] = []): Promise<Role> {
    const role = await db.getRepository(Role).save({ code, name: `Vai trò ${code}`, isDeleted: deleted, deletedAt: deleted ? deletedAt : null });
    created.roles.push(role.id);
    const permissions = [];
    for (const permissionCode of permissionCodes) {
      const existing = await db.getRepository(Permission).findOneBy({ code: permissionCode });
      const permission = existing ?? await db.getRepository(Permission).save({ code: permissionCode, description: 'Quyền test' });
      if (!existing) created.permissions.push(permission.id);
      permissions.push(permission);
    }
    if (permissions.length) {
      await db.getRepository(RolePermission).save(permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })));
    }
    return role;
  }

  async function createRoom(deleted: boolean): Promise<Room> {
    const room = await db.getRepository(Room).save({
      slug: `${tag}-${randomUUID().slice(0, 6)}`,
      name: `Phòng ${randomUUID().slice(0, 4)}`,
      isDeleted: deleted,
      deletedAt: deleted ? deletedAt : null,
    });
    created.rooms.push(room.id);
    return room;
  }

  async function createExhibit(roomId: string, deleted: boolean, displayOrder: number): Promise<Exhibit> {
    const exhibit = await db.getRepository(Exhibit).save({
      roomId,
      visibility: ExhibitVisibility.HIDDEN,
      version: 1,
      displayOrder,
      isDeleted: deleted,
      deletedAt: deleted ? deletedAt : null,
    });
    created.exhibits.push(exhibit.id);
    return exhibit;
  }

  async function createMedia(deleted: boolean): Promise<Media> {
    const id = randomUUID();
    const media = await db.getRepository(Media).save({
      id,
      kind: MediaKind.IMAGE,
      storageKey: `uploads/images/${id}.png`,
      mimeType: 'image/png',
      sizeBytes: '100',
      checksumSha256: 'a'.repeat(64),
      processingState: MediaProcessingState.READY,
      originalName: `${tag}.png`,
      isDeleted: deleted,
      deletedAt: deleted ? deletedAt : null,
    });
    created.media.push(media.id);
    return media;
  }

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    workDir = await mkdtemp(join(tmpdir(), 'trash-restore-'));
    const tx = new TransactionManager(db);

    const rolesRepo = new RolesRepository(db.getRepository(Role));
    const roomsRepo = new RoomsRepository(db.getRepository(Room));
    const mediaRepo = new MediaRepository(db.getRepository(Media));
    const references = new MediaReferenceValidator(mediaRepo);
    usersService = new UsersService(
      new UsersRepository(db.getRepository(User)),
      new UserRolesRepository(db.getRepository(UserRole), db.getRepository(Role)),
      new PasswordService({ get: () => 10 } as unknown as ConfigService),
      tx,
      new RefreshSessionsRepository(db.getRepository(RefreshSession)),
    );
    rolesService = new RolesService(
      rolesRepo,
      new PermissionsRepository(db.getRepository(Permission), db.getRepository(RolePermission)),
      tx,
    );
    roomsService = new RoomsService(roomsRepo, tx);
    mediaService = new MediaService(
      mediaRepo,
      new MediaStorageService(new LocalStorageDriver({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'q') })),
      new MediaInspectionService(),
      tx,
      testMediaUrlService(),
    );
    exhibitsService = new ExhibitsService(
      new ExhibitsRepository(db.getRepository(Exhibit), db.getRepository(ExhibitRevision), db.getRepository(Hotspot)),
      roomsRepo,
      tx,
      references,
      new RevisionPublishGate(references),
      testMediaUrlService(),
    );
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.exhibits.length) await db.query('DELETE FROM exhibits WHERE id = ANY($1)', [created.exhibits]);
    if (created.media.length) await db.query('DELETE FROM media WHERE id = ANY($1)', [created.media]);
    if (created.rooms.length) await db.query('DELETE FROM rooms WHERE id = ANY($1)', [created.rooms]);
    if (created.users.length) {
      await db.query('DELETE FROM user_roles WHERE user_id = ANY($1)', [created.users]);
      await db.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
    }
    if (created.roles.length) {
      await db.query('DELETE FROM user_roles WHERE role_id = ANY($1)', [created.roles]);
      await db.query('DELETE FROM role_permissions WHERE role_id = ANY($1)', [created.roles]);
      await db.query('DELETE FROM roles WHERE id = ANY($1)', [created.roles]);
    }
    if (created.permissions.length) await db.query('DELETE FROM permissions WHERE id = ANY($1)', [created.permissions]);
    await db.destroy();
    await rm(workDir, { recursive: true, force: true });
  });

  describe('Tài khoản', () => {
    it('deleted=true chỉ trả tài khoản đã xóa (kèm deletedAt); danh sách thường không có chúng', async () => {
      const live = await createUser(false, 'live');
      const trashed = await createUser(true, 'trashed');
      const trash = await usersService.list({ page: 1, pageSize: 100, q: tag, deleted: true } as never);
      assert.deepEqual(trash.items.map((item) => item.id), [trashed.id]);
      assert.equal((trash.items[0] as { deletedAt: Date }).deletedAt.toISOString(), deletedAt.toISOString());
      const active = await usersService.list({ page: 1, pageSize: 100, q: tag } as never);
      assert.ok(active.items.some((item) => item.id === live.id));
      assert.ok(active.items.every((item) => item.id !== trashed.id && !('deletedAt' in item)));
    });

    it('khôi phục: bỏ liên kết tới vai trò đã xóa, giữ vai trò còn sống; vai trò đã xóa không cấp quyền', async () => {
      const liveRole = await createRole(`${tag}-live`, false, [READ]);
      const deadRole = await createRole(`${tag}-dead`, true, [DELETE]);
      const user = await createUser(true, 'roles');
      await db.getRepository(UserRole).save([{ userId: user.id, roleId: liveRole.id }, { userId: user.id, roleId: deadRole.id }]);

      // Trước khi khôi phục: liên kết cũ vẫn còn nhưng vai trò đã xóa không cấp quyền.
      const before = await db.getRepository(User).findOne({
        where: { id: user.id },
        relations: ['userRoles', 'userRoles.role', 'userRoles.role.rolePermissions', 'userRoles.role.rolePermissions.permission'],
      });
      assert.deepEqual(toAuthUser(before!).permissions, [READ]);

      assert.deepEqual(await usersService.restoreMany([user.id]), { ids: [user.id] });
      const restored = await usersService.getById(user.id);
      assert.deepEqual(restored.roles, [liveRole.code]);
      const links = await db.getRepository(UserRole).find({ where: { userId: user.id } });
      assert.deepEqual(links.map((link) => link.roleId), [liveRole.id]);
    });

    it('tất cả hoặc không: có ID đang dùng / không tồn tại → 409 từng ID, không tài khoản nào được khôi phục', async () => {
      const trashed = await createUser(true, 'atomic');
      const live = await createUser(false, 'atomic-live');
      const ghost = randomUUID();
      await assert.rejects(usersService.restoreMany([trashed.id, live.id, ghost]), (error) => {
        assert.deepEqual(restoreErrors(error).map(([id]) => id), [live.id, ghost]);
        return true;
      });
      assert.equal((await db.getRepository(User).findOneByOrFail({ id: trashed.id })).isDeleted, true);
    });
  });

  describe('Vai trò', () => {
    it('khôi phục giữ nguyên quyền; mã đã thuộc vai trò khác hoặc trùng trong cùng lô → 409, không vai trò nào được khôi phục', async () => {
      const ok = await createRole(`${tag}-ok`, true, [READ]);
      const code = `${tag}-dup`;
      await createRole(code, false);
      const taken = await createRole(code, true);
      const twinCode = `${tag}-twin`;
      const twinA = await createRole(twinCode, true);
      const twinB = await createRole(twinCode, true);

      const trash = await rolesService.list(true);
      assert.ok(trash.some((role) => role.id === ok.id && 'deletedAt' in role));
      assert.ok((await rolesService.list()).every((role) => role.id !== ok.id));

      await assert.rejects(rolesService.restoreMany([ok.id, taken.id, twinA.id, twinB.id]), (error) => {
        const errors = restoreErrors(error);
        assert.deepEqual(errors.map(([id]) => id), [taken.id, twinB.id]);
        assert.match(errors[0][1], new RegExp(`Mã "${code}" đang được vai trò "Vai trò ${code}" sử dụng`));
        assert.match(errors[1][1], /trùng với một vai trò khác cũng đang được khôi phục/);
        return true;
      });
      assert.equal((await db.getRepository(Role).findOneByOrFail({ id: ok.id })).isDeleted, true);

      assert.deepEqual(await rolesService.restoreMany([ok.id, twinA.id]), { ids: [ok.id, twinA.id] });
      assert.deepEqual((await rolesService.getById(ok.id)).permissions, [READ]);
    });
  });

  describe('Phòng', () => {
    it('tạo phòng trùng slug của phòng đã xóa → 409 gợi ý khôi phục (không còn lỗi DB 500)', async () => {
      const trashed = await createRoom(true);
      await assert.rejects(roomsService.create({ slug: trashed.slug, name: 'Mới' }), (error) => {
        assert.ok(error instanceof ConflictException);
        assert.match(error.message, new RegExp(`Slug "${trashed.slug}" thuộc phòng đã xóa "${trashed.name}"\\. Khôi phục phòng đó`));
        return true;
      });
    });

    it('danh sách thùng rác + khôi phục; phòng không nằm trong thùng rác → 409', async () => {
      const trashed = await createRoom(true);
      const live = await createRoom(false);
      const trash = await roomsService.list({ page: 1, pageSize: 100, q: tag, deleted: true } as never);
      assert.ok(trash.items.some((room) => room.id === trashed.id && 'deletedAt' in room));
      assert.ok(trash.items.every((room) => room.id !== live.id));

      await assert.rejects(roomsService.restoreMany([trashed.id, live.id]), (error) => {
        assert.deepEqual(restoreErrors(error), [[live.id, 'Không tìm thấy phòng trong mục đã xóa']]);
        return true;
      });
      assert.deepEqual(await roomsService.restoreMany([trashed.id]), { ids: [trashed.id] });
      assert.equal((await roomsService.getById(trashed.id)).id, trashed.id);
    });
  });

  describe('Media', () => {
    it('danh sách thùng rác + khôi phục tất cả hoặc không', async () => {
      const a = await createMedia(true);
      const b = await createMedia(true);
      const live = await createMedia(false);
      const trash = await mediaService.list({ page: 1, pageSize: 100, q: tag, deleted: true } as never);
      assert.deepEqual(new Set(trash.items.map((item) => item.id)), new Set([a.id, b.id]));

      await assert.rejects(mediaService.restoreMany([a.id, live.id]), (error) => {
        assert.deepEqual(restoreErrors(error).map(([id]) => id), [live.id]);
        return true;
      });
      assert.deepEqual(await mediaService.restoreMany([a.id, b.id]), { ids: [a.id, b.id] });
      assert.equal((await mediaService.getById(b.id)).id, b.id);
    });
  });

  describe('Hiện vật', () => {
    it('phòng đã xóa → 409 "khôi phục phòng trước"; khôi phục phòng rồi hiện vật về cuối thứ tự hiển thị', async () => {
      const room = await createRoom(false);
      await createExhibit(room.id, false, 4);
      await createExhibit(room.id, true, 99);
      const first = await createExhibit(room.id, true, 1);
      const second = await createExhibit(room.id, true, 2);
      await db.getRepository(Room).update({ id: room.id }, { isDeleted: true, deletedAt });

      const trash = await exhibitsService.searchAdminExhibits({ page: 1, pageSize: 100, roomId: room.id, deleted: true } as never);
      assert.equal(trash.items.length, 3);
      assert.ok(trash.items.every((item) => 'deletedAt' in item));

      await assert.rejects(exhibitsService.restoreMany([first.id]), (error) => {
        assert.deepEqual(restoreErrors(error), [[first.id, `Phòng "${room.name}" đã bị xóa. Hãy khôi phục phòng trước.`]]);
        return true;
      });

      await roomsService.restoreMany([room.id]);
      assert.deepEqual(await exhibitsService.restoreMany([first.id, second.id]), { ids: [first.id, second.id] });
      const orders = await db.getRepository(Exhibit).find({ where: { id: In([first.id, second.id]) } });
      // Hiện vật sống có thứ tự lớn nhất là 4 (hiện vật còn trong thùng rác không tính).
      assert.deepEqual(orders.map((exhibit) => exhibit.displayOrder).sort(), [5, 6]);
      assert.ok(orders.every((exhibit) => !exhibit.isDeleted && exhibit.deletedAt === null));
    });
  });
});
