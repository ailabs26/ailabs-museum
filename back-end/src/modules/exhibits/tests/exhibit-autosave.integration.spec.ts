import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { Media } from '../../media/entities/media.entity';
import { MediaRepository } from '../../media/repositories/media.repository';
import { MediaReferenceValidator } from '../../media/services/media-reference.validator';
import { testMediaUrlService } from '../../media/tests/media-test-doubles';
import { Room } from '../../rooms/entities/room.entity';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { User } from '../../users/entities/user.entity';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { ExhibitsService } from '../services/exhibits.service';
import { RevisionPublishGate } from '../services/revision-publish.gate';
import { notificationsStub } from '../../notifications/tests/notifications.stub';

/**
 * VT-079 trên PostgreSQL THẬT: bản lưu cũ không được ghi đè bản mới (AC2–AC4, R2/R5/R7/R8).
 * Chỉ chạy khi AUTOSAVE_TEST_DATABASE_URL trỏ localhost — không bao giờ chạm DB dùng chung.
 */
const TEST_DATABASE_URL = process.env.AUTOSAVE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần AUTOSAVE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

const CONTENT = {
  name: { vi: 'Bản gốc' },
  description: { vi: 'Mô tả' },
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

describe('VT-079 · autosave chống ghi đè (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let service: ExhibitsService;
  const tag = `vt079-${randomUUID().slice(0, 8)}`;
  const created = { users: [] as string[], rooms: [] as string[], exhibits: [] as string[] };
  let user: { id: string };
  let roomId: string;

  const save = (id: string, name: string, expectedVersion: number) =>
    service.updateExhibitDraft(id, plainToInstance(UpdateExhibitDto, { name: { vi: name }, expectedVersion }), user);

  async function createExhibit(state = RevisionState.DRAFT) {
    const exhibit = await db.getRepository(Exhibit).save({ roomId, visibility: ExhibitVisibility.HIDDEN, version: 1 });
    created.exhibits.push(exhibit.id);
    const revision = await db.getRepository(ExhibitRevision).save({
      exhibitId: exhibit.id, revisionNo: 1, state, content: CONTENT as never, createdById: user.id,
    });
    if (state === RevisionState.APPROVED) {
      await db.getRepository(Exhibit).update(exhibit.id, { publishedRevisionId: revision.id, visibility: ExhibitVisibility.VISIBLE });
    }
    return exhibit.id;
  }

  /** Trạng thái thật trong DB: version hiện vật + tên ở revision mới nhất. */
  async function stored(id: string) {
    const exhibit = await db.getRepository(Exhibit).findOneByOrFail({ id });
    const latest = await db.getRepository(ExhibitRevision).findOneOrFail({ where: { exhibitId: id }, order: { revisionNo: 'DESC' } });
    return { version: exhibit.version, name: (latest.content as unknown as typeof CONTENT).name.vi, state: latest.state, revisionNo: latest.revisionNo };
  }

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL, ssl: undefined } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    const references = new MediaReferenceValidator(new MediaRepository(db.getRepository(Media)));
    const exhibitsRepo = new ExhibitsRepository(db.getRepository(Exhibit), db.getRepository(ExhibitRevision), db.getRepository(Hotspot));
    service = new ExhibitsService(
      exhibitsRepo,
      new RoomsRepository(db.getRepository(Room)),
      new TransactionManager(db),
      references,
      new RevisionPublishGate(references, exhibitsRepo),
      testMediaUrlService(),
      notificationsStub(),
    );
    const u = await db.getRepository(User).save({ email: `${tag}@example.test`, passwordHash: 'not-a-real-hash', displayName: 'VT-079' });
    created.users.push(u.id);
    user = { id: u.id };
    const room = await db.getRepository(Room).save({ slug: tag, name: 'Phòng VT-079' });
    created.rooms.push(room.id);
    roomId = room.id;
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.exhibits.length) {
      await db.query('UPDATE exhibits SET published_revision_id = NULL WHERE id = ANY($1)', [created.exhibits]);
      await db.query('DELETE FROM hotspots WHERE revision_id IN (SELECT id FROM exhibit_revisions WHERE exhibit_id = ANY($1))', [created.exhibits]);
      await db.query('DELETE FROM exhibit_revisions WHERE exhibit_id = ANY($1)', [created.exhibits]);
      await db.query('DELETE FROM exhibits WHERE id = ANY($1)', [created.exhibits]);
    }
    await db.query('DELETE FROM rooms WHERE id = ANY($1)', [created.rooms]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
    await db.destroy();
  });

  it('TC06 (AC2/AC4): replay bản A cũ sau khi bản B đã lưu → 409, DB vẫn giữ bản B', async () => {
    const id = await createExhibit();
    await save(id, 'Bản A', 1);
    await save(id, 'Bản B', 2);
    await assert.rejects(save(id, 'Bản A', 1), ConflictException);
    assert.deepEqual(await stored(id), { version: 3, name: 'Bản B', state: RevisionState.DRAFT, revisionNo: 1 });
  });

  for (const n of [2, 10]) {
    it(`TC07 (AC3/R8): ${n} autosave song song cùng expectedVersion → đúng 1 thành công, version +1`, async () => {
      const id = await createExhibit();
      const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => save(id, `Tab ${i}`, 1)));
      const ok = results.flatMap((r, i) => (r.status === 'fulfilled' ? [`Tab ${i}`] : []));
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      assert.equal(ok.length, 1, `số request thành công: ${ok.length}`);
      assert.ok(rejected.every((r) => r.reason instanceof ConflictException));
      const after = await stored(id);
      assert.equal(after.version, 2);
      assert.equal(after.name, ok[0], 'nội dung trong DB phải là của request thắng');
    });
  }

  it('TC08 (R7): bản đã xuất bản + version khớp → fork revision mới; autosave cũ sau đó → 409', async () => {
    const id = await createExhibit(RevisionState.APPROVED);
    await save(id, 'Bản sửa sau xuất bản', 1);
    assert.deepEqual(await stored(id), { version: 2, name: 'Bản sửa sau xuất bản', state: RevisionState.DRAFT, revisionNo: 2 });
    await assert.rejects(save(id, 'Bản cũ từ tab khác', 1), ConflictException);
    assert.deepEqual(await stored(id), { version: 2, name: 'Bản sửa sau xuất bản', state: RevisionState.DRAFT, revisionNo: 2 });
  });

  it('TC09 (R5): đã gửi duyệt → autosave (version cũ hay khớp) bị từ chối, revision vẫn in_review', async () => {
    // Precondition R5 dựng thẳng trong DB: submit thật cần media đạt publish gate, ngoài phạm vi test này.
    const id = await createExhibit(RevisionState.IN_REVIEW);
    await db.getRepository(Exhibit).update(id, { version: 2 });
    await assert.rejects(save(id, 'Bản chậm', 1), ConflictException);
    await assert.rejects(save(id, 'Bản khớp version', 2), ConflictException);
    const after = await stored(id);
    assert.equal(after.state, RevisionState.IN_REVIEW);
    assert.equal(after.name, 'Bản gốc');
  });

  /** Autosave như FE gửi: payload luôn mang `displayOrder` đọc lúc mở drawer. */
  const autosave = (id: string, displayOrder: number, expectedVersion: number) =>
    service.updateExhibitDraft(
      id,
      plainToInstance(UpdateExhibitDto, { name: { vi: 'Autosave cũ' }, displayOrder, expectedVersion }),
      user,
    );

  async function freshRoom() {
    const room = await db.getRepository(Room).save({ slug: `${tag}-${created.rooms.length}`, name: 'Phòng reorder VT-079' });
    created.rooms.push(room.id);
    roomId = room.id;
  }

  const orderOf = async (id: string) => (await db.getRepository(Exhibit).findOneByOrFail({ id })).displayOrder;

  it('TC17 (R9, review dinhtienn): reorder trong lúc drawer mở → autosave cũ nhận 409, thứ tự mới được giữ', async () => {
    await freshRoom();
    const a = await createExhibit();
    const b = await createExhibit();
    await service.reorderExhibits(roomId, [a, b]);
    const opened = await db.getRepository(Exhibit).findOneByOrFail({ id: a }); // drawer mở: order 1
    await service.reorderExhibits(roomId, [b, a]); // người khác kéo thả: a → 2
    await assert.rejects(autosave(a, opened.displayOrder, opened.version), ConflictException);
    assert.equal(await orderOf(a), 2, 'thứ tự mới không được bị autosave cũ ghi đè');
    assert.equal(await orderOf(b), 1);
  });

  it('TC17b (R9): reorder không đổi vị trí một hiện vật → version của nó giữ nguyên, không xung đột giả', async () => {
    await freshRoom();
    const a = await createExhibit();
    const b = await createExhibit();
    const c = await createExhibit();
    await service.reorderExhibits(roomId, [a, b, c]);
    const opened = await db.getRepository(Exhibit).findOneByOrFail({ id: b });
    await service.reorderExhibits(roomId, [c, b, a]); // b vẫn ở vị trí 2
    await autosave(b, opened.displayOrder, opened.version);
    assert.equal((await stored(b)).name, 'Autosave cũ');
  });

  it('TC18 (R9): xóa rồi khôi phục trong lúc drawer mở → autosave cũ nhận 409', async () => {
    await freshRoom();
    const a = await createExhibit();
    const b = await createExhibit();
    await service.reorderExhibits(roomId, [a, b]);
    const opened = await db.getRepository(Exhibit).findOneByOrFail({ id: a });
    await service.removeMany([a]);
    await service.restoreMany([a]); // khôi phục về cuối phòng: order 3
    await assert.rejects(autosave(a, opened.displayOrder, opened.version), ConflictException);
    assert.equal(await orderOf(a), 3);
  });
});
