import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { MediaReferenceValidator } from '../../media/services/media-reference.validator';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';
import { GALLERY_SLOTS } from '../constants/gallery-slots';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { RevisionPublishGate } from '../services/revision-publish.gate';

/**
 * Gallery Template V1 trên PostgreSQL THẬT: mỗi bục của một phòng chỉ có một hiện vật công khai,
 * kể cả khi hai lần xuất bản chạy đồng thời. Chỉ chạy khi CORE_TEST_DATABASE_URL trỏ localhost.
 */
const TEST_DATABASE_URL = process.env.CORE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần CORE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

const at = (index: number) => ({ x: GALLERY_SLOTS[index].x, y: 0, z: GALLERY_SLOTS[index].z });

describe('Gallery Template · chống trùng bục (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let tx: TransactionManager;
  let gate: RevisionPublishGate;
  const tag = `slot-${randomUUID().slice(0, 8)}`;
  const created = { users: [] as string[], rooms: [] as string[], exhibits: [] as string[] };
  let userId: string;

  async function createRoom() {
    const room = await db.getRepository(Room).save({ slug: `${tag}-${created.rooms.length}`, name: 'Phòng mẫu 5 bục' });
    created.rooms.push(room.id);
    return room.id;
  }

  /** Hiện vật có một revision ở `position`; `isPublic` = đang công khai với revision đó. */
  async function createExhibit(roomId: string, position: object, isPublic: boolean, overrides: Partial<Exhibit> = {}) {
    const exhibit = await db.getRepository(Exhibit).save({ roomId, visibility: ExhibitVisibility.HIDDEN, version: 1 });
    created.exhibits.push(exhibit.id);
    const revision = await db.getRepository(ExhibitRevision).save({
      exhibitId: exhibit.id, revisionNo: 1, state: isPublic ? RevisionState.APPROVED : RevisionState.IN_REVIEW,
      content: { name: { vi: 'Hiện vật' }, description: { vi: 'Mô tả' }, position } as never, createdById: userId,
    });
    if (isPublic) {
      await db.getRepository(Exhibit).update(exhibit.id, { publishedRevisionId: revision.id, visibility: ExhibitVisibility.VISIBLE, ...overrides });
    }
    return { id: exhibit.id, revisionId: revision.id, roomId, position };
  }

  /** Cùng trình tự với ModerationService.publish: kiểm tra bục rồi mới ghi, trong một transaction. */
  const publish = (exhibit: Awaited<ReturnType<typeof createExhibit>>) => tx.run(async (manager) => {
    await gate.assertSlotFree({ exhibitId: exhibit.id, roomId: exhibit.roomId, position: exhibit.position }, manager);
    await manager.update(ExhibitRevision, { id: exhibit.revisionId }, { state: RevisionState.APPROVED });
    await manager.update(Exhibit, { id: exhibit.id }, { publishedRevisionId: exhibit.revisionId, visibility: ExhibitVisibility.VISIBLE });
  });

  const publicCount = (roomId: string) => db.getRepository(Exhibit).count({ where: { roomId, visibility: ExhibitVisibility.VISIBLE } });

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL, ssl: undefined } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    tx = new TransactionManager(db);
    gate = new RevisionPublishGate(
      {} as MediaReferenceValidator,
      new ExhibitsRepository(db.getRepository(Exhibit), db.getRepository(ExhibitRevision), db.getRepository(Hotspot)),
    );
    const user = await db.getRepository(User).save({ email: `${tag}@example.test`, passwordHash: 'not-a-real-hash', displayName: 'Slot guard' });
    created.users.push(user.id);
    userId = user.id;
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.exhibits.length) {
      await db.query('UPDATE exhibits SET published_revision_id = NULL WHERE id = ANY($1)', [created.exhibits]);
      await db.query('DELETE FROM exhibit_revisions WHERE exhibit_id = ANY($1)', [created.exhibits]);
      await db.query('DELETE FROM exhibits WHERE id = ANY($1)', [created.exhibits]);
    }
    await db.query('DELETE FROM rooms WHERE id = ANY($1)', [created.rooms]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
    await db.destroy();
  });

  it('bục đã có hiện vật công khai → 422; bục khác hoặc chính hiện vật đó → cho qua', async () => {
    const roomId = await createRoom();
    const occupant = await createExhibit(roomId, at(1), true);
    await assert.rejects(publish(await createExhibit(roomId, { x: -4.27, y: 0, z: -4.22 }, false)), UnprocessableEntityException);
    await publish(await createExhibit(roomId, at(2), false));
    await publish(occupant);
    assert.equal(await publicCount(roomId), 2);
  });

  it('hiện vật ẩn, lưu trữ, đã xóa hoặc ở phòng khác không giữ bục', async () => {
    const roomId = await createRoom();
    const hidden = await createExhibit(roomId, at(0), true);
    await db.getRepository(Exhibit).update(hidden.id, { visibility: ExhibitVisibility.HIDDEN });
    await createExhibit(roomId, at(0), true, { archivedAt: new Date() });
    await createExhibit(roomId, at(0), true, { isDeleted: true, deletedAt: new Date() });
    await createExhibit(await createRoom(), at(0), true);
    await publish(await createExhibit(roomId, at(0), false));
  });

  it('tọa độ tự do trùng nhau (phòng legacy) không bị chặn', async () => {
    const roomId = await createRoom();
    await createExhibit(roomId, { x: 1, y: 0, z: 1 }, true);
    await publish(await createExhibit(roomId, { x: 1, y: 0, z: 1 }, false));
    assert.equal(await publicCount(roomId), 2);
  });

  for (const contenders of [2, 6]) {
    it(`${contenders} lần xuất bản đồng thời vào cùng một bục → đúng 1 thành công`, async () => {
      const roomId = await createRoom();
      const exhibits = [];
      for (let index = 0; index < contenders; index++) exhibits.push(await createExhibit(roomId, at(0), false));
      const results = await Promise.allSettled(exhibits.map(publish));
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      assert.equal(results.length - rejected.length, 1);
      assert.ok(rejected.every((result) => result.reason instanceof UnprocessableEntityException), rejected.map((result) => String(result.reason)).join('; '));
      assert.equal(await publicCount(roomId), 1);
    });
  }
});
