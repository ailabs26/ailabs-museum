import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { dataSource } from '../../config/data-source';
import { RoleKey } from '../../common/enums/role.enum';
import { Exhibit, ExhibitVisibility } from '../../modules/exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../modules/exhibits/entities/exhibit-revision.entity';
import { Media, MediaKind, MediaProcessingState } from '../../modules/media/entities/media.entity';
import { ModelStorageService } from '../../modules/media/services/model-storage.service';
import { Room, RoomStatus } from '../../modules/rooms/entities/room.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { STORAGE_MODELS, STORAGE_MODEL_ROOM } from './storage-model-content';

class StorageSeedError extends Error {}

export async function verifyStorageModels(storage: ModelStorageService) {
  for (const model of STORAGE_MODELS) {
    const asset = await storage.open(model.key, model.size);
    const hash = createHash('sha256');
    let header = Buffer.alloc(0);
    for await (const chunk of asset.stream) {
      const bytes = Buffer.from(chunk as Uint8Array);
      if (header.length < 12) header = Buffer.concat([header, bytes.subarray(0, 12 - header.length)]);
      hash.update(bytes);
    }
    if (header.length !== 12 || header.readUInt32LE(0) !== 0x46546c67 || header.readUInt32LE(4) !== 2
      || header.readUInt32LE(8) !== model.size || hash.digest('hex') !== model.checksum) {
      throw new StorageSeedError(`GLB không khớp bản đã kiểm tra: ${model.key}`);
    }
  }
}

/** Additive content seed, never a migration; abort on ID/path collisions. */
export async function seedStorageModels(source: DataSource, adminEmail: string) {
  return source.transaction(async manager => {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext('seed-storage-models'))");
    const admin = await manager.findOne(User, { where: { email: adminEmail.trim(), status: UserStatus.ACTIVE, isDeleted: false } });
    if (!admin || !await manager.count(UserRole, { where: { userId: admin.id, role: { code: RoleKey.ADMIN } } })) {
      throw new StorageSeedError('Cần tài khoản admin active có sẵn.');
    }
    let room = await manager.findOne(Room, { where: { id: STORAGE_MODEL_ROOM.id } });
    if (room && room.slug !== STORAGE_MODEL_ROOM.slug) throw new StorageSeedError('ID phòng đã được dùng; không tự sửa.');
    if (!room) {
      if (await manager.findOne(Room, { where: { slug: STORAGE_MODEL_ROOM.slug } })) throw new StorageSeedError('Slug phòng đã được dùng.');
      room = await manager.save(Room, manager.create(Room, { ...STORAGE_MODEL_ROOM, name: 'Bộ sưu tập mô hình 3D',
        description: 'Năm mô hình số từ bộ tệp hiện vật đã cung cấp. Tên theo tệp nguồn; hồ sơ lịch sử và kích thước thật chưa được thẩm định.', status: RoomStatus.ACTIVE }));
    }
    let created = 0;
    for (const [index, model] of STORAGE_MODELS.entries()) {
      const media = await manager.findOne(Media, { where: [{ id: model.mediaId }, { storageKey: model.key }] });
      const exhibit = await manager.findOne(Exhibit, { where: { id: model.exhibitId } });
      const revision = await manager.findOne(ExhibitRevision, { where: { id: model.revisionId } });
      if (media || exhibit || revision) {
        if (!media || !exhibit || !revision || media.id !== model.mediaId || media.storageKey !== model.key
          || media.checksumSha256 !== model.checksum || exhibit.roomId !== room.id
          || revision.exhibitId !== exhibit.id || revision.modelMediaId !== media.id) {
          throw new StorageSeedError(`Mapping đã thay đổi tại ${model.key}; không tự ghi đè.`);
        }
        continue; // Preserve later edits, hidden/deleted state and publication pointers.
      }
      await manager.save(Media, manager.create(Media, { id: model.mediaId, kind: MediaKind.MODEL, storageKey: model.key,
        mimeType: 'model/gltf-binary', sizeBytes: String(model.size), checksumSha256: model.checksum,
        processingState: MediaProcessingState.READY, altText: model.name, createdById: admin.id }));
      await manager.save(Exhibit, manager.create(Exhibit, { id: model.exhibitId, roomId: room.id,
        displayOrder: index, visibility: ExhibitVisibility.HIDDEN, version: 0 }));
      await manager.save(ExhibitRevision, manager.create(ExhibitRevision, { id: model.revisionId, exhibitId: model.exhibitId,
        revisionNo: 1, state: RevisionState.APPROVED, modelMediaId: model.mediaId,
        content: { name: model.name, description: `Mô hình số từ tệp ${model.key.split('/').pop()}. Tên theo tệp nguồn; niên đại, xuất xứ và kích thước thật chưa được thẩm định.`,
          position: model.position, placeholderShape: 'cylinder', placeholderColor: '#8b7355' },
        createdById: admin.id, reviewedById: admin.id, reviewedAt: new Date(),
        reason: 'Mapping trưng bày GLB theo yêu cầu triển khai; không xác nhận hồ sơ lịch sử.' }));
      await manager.update(Exhibit, model.exhibitId, { publishedRevisionId: model.revisionId, visibility: ExhibitVisibility.VISIBLE, version: 1 });
      created++;
    }
    return { created, skipped: STORAGE_MODELS.length - created };
  });
}

if (require.main === module) {
  void (async () => {
    if (!process.env.DATABASE_URL || !process.env.SEED_ADMIN_EMAIL) throw new StorageSeedError('Thiếu DATABASE_URL hoặc SEED_ADMIN_EMAIL.');
    await verifyStorageModels(new ModelStorageService(new ConfigService(process.env)));
    await dataSource.initialize();
    try { console.log(await seedStorageModels(dataSource, process.env.SEED_ADMIN_EMAIL)); }
    finally { await dataSource.destroy(); }
  })().catch((error: unknown) => {
    console.error(error instanceof StorageSeedError ? error.message : 'Seed GLB thất bại; kiểm tra kết nối/cấu hình/schema.');
    process.exitCode = 1;
  });
}
