import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import { dataSource } from '../../config/data-source';
import { RoleKey } from '../../common/enums/role.enum';
import { Exhibit, ExhibitVisibility } from '../../modules/exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../modules/exhibits/entities/exhibit-revision.entity';
import { Room, RoomStatus } from '../../modules/rooms/entities/room.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { DEMO_EXHIBITS, DEMO_ROOM_SLUG } from './demo-content';

class DemoSeedError extends Error {}

export async function seedDemoContent(source: DataSource, adminEmail: string) {
  return source.transaction(async (manager) => {
    const room = await manager.findOne(Room, {
      where: { slug: DEMO_ROOM_SLUG, status: RoomStatus.ACTIVE, isDeleted: false },
      lock: { mode: 'pessimistic_write' },
    });
    if (!room) throw new DemoSeedError('Không tìm thấy phòng active để seed demo.');

    const admin = await manager.findOne(User, {
      where: { email: adminEmail.trim(), status: UserStatus.ACTIVE, isDeleted: false },
    });
    if (!admin || !await manager.count(UserRole, {
      where: { userId: admin.id, role: { code: RoleKey.ADMIN } },
    })) throw new DemoSeedError('Không tìm thấy admin active có vai trò admin.');

    const missing: typeof DEMO_EXHIBITS = [];
    for (const item of DEMO_EXHIBITS) {
      const exhibit = await manager.findOne(Exhibit, { where: { id: item.id } });
      const revision = await manager.findOne(ExhibitRevision, { where: { id: item.revisionId } });
      if (!exhibit && !revision) {
        missing.push(item);
      } else if (!exhibit || !revision || exhibit.roomId !== room.id || revision.exhibitId !== item.id) {
        throw new DemoSeedError(`Dữ liệu demo không nhất quán tại ID ${item.id}; không tự sửa.`);
      }
    }

    for (const item of missing) {
      const exhibit = await manager.save(Exhibit, manager.create(Exhibit, {
        id: item.id, roomId: room.id, displayOrder: item.displayOrder,
        visibility: ExhibitVisibility.HIDDEN, version: 0,
      }));
      const revision = await manager.save(ExhibitRevision, manager.create(ExhibitRevision, {
        id: item.revisionId, exhibitId: exhibit.id, revisionNo: 1,
        state: RevisionState.APPROVED, content: structuredClone(item.content),
        createdById: admin.id, reviewedById: admin.id, reviewedAt: new Date(),
        reason: 'Khởi tạo nội dung demo cho phát triển, không phải hồ sơ hiện vật thật.',
      }));
      exhibit.publishedRevisionId = revision.id;
      exhibit.visibility = ExhibitVisibility.VISIBLE;
      exhibit.version = 1;
      await manager.save(Exhibit, exhibit);
    }
    return { created: missing.length, skipped: DEMO_EXHIBITS.length - missing.length };
  });
}

export async function runDemoContentSeed(source: DataSource, env: NodeJS.ProcessEnv) {
  if (!env.DATABASE_URL?.trim()) throw new DemoSeedError('Thiếu DATABASE_URL.');
  if (!env.SEED_ADMIN_EMAIL?.trim()) throw new DemoSeedError('Thiếu SEED_ADMIN_EMAIL.');
  try {
    await source.initialize();
    return await seedDemoContent(source, env.SEED_ADMIN_EMAIL);
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}

if (require.main === module) {
  runDemoContentSeed(dataSource, process.env)
    .then(({ created, skipped }) => console.log(`Seed demo xong: tạo ${created}, bỏ qua ${skipped}.`))
    .catch((error: unknown) => {
      // Database errors can contain connection details; only print controlled messages.
      console.error(error instanceof DemoSeedError ? error.message : 'Seed demo thất bại; kiểm tra kết nối và schema database.');
      process.exitCode = 1;
    });
}
