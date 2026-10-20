import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../exhibits/entities/exhibit-revision.entity';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';
import { MediaRepository } from '../repositories/media.repository';

/**
 * Integration test trên PostgreSQL THẬT. Chỉ chạy khi đặt MEDIA_TEST_DATABASE_URL trỏ tới
 * database cục bộ (localhost) — không bao giờ chạy trên database dùng chung/Supabase.
 * Test chỉ thêm/xóa bản ghi do chính nó tạo.
 */
const TEST_DATABASE_URL = process.env.MEDIA_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần MEDIA_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

describe('MediaRepository (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let repo: MediaRepository;
  const tag = `itest-${randomUUID().slice(0, 8)}`;
  const created = { users: [] as string[], rooms: [] as string[], exhibits: [] as string[], revisions: [] as string[], media: [] as string[] };
  let userId: string;
  let roomId: string;

  async function createMedia(overrides: Partial<Media> = {}): Promise<Media> {
    const id = randomUUID();
    const media = await db.getRepository(Media).save({
      id,
      kind: MediaKind.IMAGE,
      storageKey: `uploads/images/${id}.png`,
      mimeType: 'image/png',
      sizeBytes: '100',
      checksumSha256: 'a'.repeat(64),
      processingState: MediaProcessingState.READY,
      originalName: `${tag}-${id.slice(0, 4)}.png`,
      createdById: userId,
      ...overrides,
    });
    created.media.push(media.id);
    return media;
  }

  /** Tạo exhibit + revision; `publish` gắn revision làm bản published. */
  async function createRevision(
    slots: Partial<Pick<ExhibitRevision, 'modelMediaId' | 'imageMediaId' | 'audioMediaId'>>,
    options: { state?: RevisionState; publish?: boolean; deleteExhibit?: boolean } = {},
  ): Promise<{ exhibit: Exhibit; revision: ExhibitRevision }> {
    const exhibit = await db.getRepository(Exhibit).save({ roomId });
    created.exhibits.push(exhibit.id);
    const revision = await db.getRepository(ExhibitRevision).save({
      exhibitId: exhibit.id,
      revisionNo: 1,
      state: options.state ?? RevisionState.DRAFT,
      content: { name: 'Hiện vật test', description: 'Mô tả', position: { x: 0, y: 0, z: 0 } },
      createdById: userId,
      ...slots,
    });
    created.revisions.push(revision.id);
    if (options.publish) {
      await db.getRepository(Exhibit).update(exhibit.id, { publishedRevisionId: revision.id });
    }
    if (options.deleteExhibit) {
      await db.getRepository(Exhibit).update(exhibit.id, { isDeleted: true, deletedAt: new Date() });
    }
    return { exhibit, revision };
  }

  const queryOf = (overrides: Partial<ListMediaQueryDto> = {}) =>
    Object.assign(new ListMediaQueryDto(), { q: tag, page: 1, pageSize: 20, ...overrides });

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    repo = new MediaRepository(db.getRepository(Media));

    const user = await db.getRepository(User).save({
      email: `${tag}@example.test`,
      passwordHash: 'not-a-real-hash',
      displayName: 'Integration test',
    });
    userId = user.id;
    created.users.push(user.id);
    const room = await db.getRepository(Room).save({ slug: tag, name: 'Phòng test' });
    roomId = room.id;
    created.rooms.push(room.id);
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.exhibits.length) {
      await db.query('UPDATE exhibits SET published_revision_id = NULL WHERE id = ANY($1)', [created.exhibits]);
    }
    if (created.revisions.length) await db.query('DELETE FROM exhibit_revisions WHERE id = ANY($1)', [created.revisions]);
    if (created.exhibits.length) await db.query('DELETE FROM exhibits WHERE id = ANY($1)', [created.exhibits]);
    if (created.media.length) await db.query('DELETE FROM media WHERE id = ANY($1)', [created.media]);
    if (created.rooms.length) await db.query('DELETE FROM rooms WHERE id = ANY($1)', [created.rooms]);
    if (created.users.length) await db.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
    await db.destroy();
  });

  describe('findActiveById', () => {
    it('trả về media đang hoạt động', async () => {
      const media = await createMedia();
      assert.equal((await repo.findActiveById(media.id))?.id, media.id);
    });

    it('media đã xóa mềm → null', async () => {
      const media = await createMedia({ isDeleted: true, deletedAt: new Date() });
      assert.equal(await repo.findActiveById(media.id), null);
    });

    it('id không tồn tại → null', async () => {
      assert.equal(await repo.findActiveById(randomUUID()), null);
    });
  });

  describe('listPaginated', () => {
    let audio: Media;
    let quarantined: Media;

    before(async () => {
      audio = await createMedia({ kind: MediaKind.AUDIO, mimeType: 'audio/mpeg', author: `Nghệ nhân ${tag}` });
      quarantined = await createMedia({ processingState: MediaProcessingState.QUARANTINED, storageKey: `quarantine/${randomUUID()}.bin` });
      await createMedia({ isDeleted: true, deletedAt: new Date(), kind: MediaKind.AUDIO });
    });

    it('không trả media đã xóa mềm', async () => {
      const result = await repo.listPaginated(queryOf({ pageSize: 100 }));
      assert.ok(result.items.every((item) => !item.isDeleted));
    });

    it('lọc theo kind', async () => {
      const result = await repo.listPaginated(queryOf({ kind: MediaKind.AUDIO }));
      assert.deepEqual(result.items.map((item) => item.id), [audio.id]);
      assert.equal(result.total, 1);
    });

    it('lọc theo trạng thái quarantined', async () => {
      const result = await repo.listPaginated(queryOf({ state: MediaProcessingState.QUARANTINED }));
      assert.deepEqual(result.items.map((item) => item.id), [quarantined.id]);
    });

    it('tìm theo tác giả (ILIKE, không phân biệt hoa thường)', async () => {
      const result = await repo.listPaginated(queryOf({ q: `NGHỆ NHÂN ${tag.toUpperCase()}` }));
      assert.deepEqual(result.items.map((item) => item.id), [audio.id]);
    });

    it('ký tự % trong từ khóa được hiểu là ký tự thường, không phải wildcard', async () => {
      const result = await repo.listPaginated(queryOf({ q: `${tag}%` }));
      assert.equal(result.total, 0);
    });

    it('phân trang: total đúng, items theo pageSize, mới nhất trước', async () => {
      const all = await repo.listPaginated(queryOf({ pageSize: 100 }));
      const firstPage = await repo.listPaginated(queryOf({ pageSize: 1, page: 1 }));
      const secondPage = await repo.listPaginated(queryOf({ pageSize: 1, page: 2 }));
      assert.equal(firstPage.total, all.total);
      assert.equal(firstPage.items.length, 1);
      assert.notEqual(firstPage.items[0].id, secondPage.items[0].id);
      const times = all.items.map((item) => item.createdAt.getTime());
      assert.deepEqual(times, [...times].sort((a, b) => b - a));
    });

    it('pageSize vượt 100 được kẹp về 100', async () => {
      const result = await repo.listPaginated(queryOf({ pageSize: 1000 }));
      assert.equal(result.pageSize, 100);
    });
  });

  describe('countUsage (BR-21)', () => {
    it('media không được dùng → 0/0', async () => {
      const media = await createMedia();
      assert.deepEqual(await repo.countUsage(media.id), { publishedExhibits: 0, pendingRevisions: 0 });
    });

    it('ảnh trong revision đang published → publishedExhibits = 1', async () => {
      const media = await createMedia();
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.APPROVED, publish: true });
      assert.equal((await repo.countUsage(media.id)).publishedExhibits, 1);
    });

    it('model trong revision đang published → được tính', async () => {
      const media = await createMedia({ kind: MediaKind.MODEL, mimeType: 'model/gltf-binary' });
      await createRevision({ modelMediaId: media.id }, { state: RevisionState.APPROVED, publish: true });
      assert.equal((await repo.countUsage(media.id)).publishedExhibits, 1);
    });

    it('audio trong revision đang published → được tính', async () => {
      const media = await createMedia({ kind: MediaKind.AUDIO, mimeType: 'audio/mpeg' });
      await createRevision({ audioMediaId: media.id }, { state: RevisionState.APPROVED, publish: true });
      assert.equal((await repo.countUsage(media.id)).publishedExhibits, 1);
    });

    it('cùng media dùng bởi 2 exhibit published → 2', async () => {
      const media = await createMedia();
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.APPROVED, publish: true });
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.APPROVED, publish: true });
      assert.equal((await repo.countUsage(media.id)).publishedExhibits, 2);
    });

    it('revision published của exhibit đã xóa mềm → không tính', async () => {
      const media = await createMedia();
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.APPROVED, publish: true, deleteExhibit: true });
      assert.deepEqual(await repo.countUsage(media.id), { publishedExhibits: 0, pendingRevisions: 0 });
    });

    it('revision approved nhưng KHÔNG phải bản published hiện hành → không tính', async () => {
      const media = await createMedia();
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.APPROVED, publish: false });
      assert.equal((await repo.countUsage(media.id)).publishedExhibits, 0);
    });

    it('chỉ dùng trong bản nháp → 0/0', async () => {
      const media = await createMedia();
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.DRAFT });
      assert.deepEqual(await repo.countUsage(media.id), { publishedExhibits: 0, pendingRevisions: 0 });
    });

    it('revision bị từ chối → 0/0', async () => {
      const media = await createMedia();
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.REJECTED });
      assert.deepEqual(await repo.countUsage(media.id), { publishedExhibits: 0, pendingRevisions: 0 });
    });

    it('revision đang chờ duyệt → pendingRevisions = 1', async () => {
      const media = await createMedia();
      await createRevision({ audioMediaId: media.id }, { state: RevisionState.IN_REVIEW });
      assert.deepEqual(await repo.countUsage(media.id), { publishedExhibits: 0, pendingRevisions: 1 });
    });

    it('revision chờ duyệt của exhibit đã xóa → không tính', async () => {
      const media = await createMedia();
      await createRevision({ audioMediaId: media.id }, { state: RevisionState.IN_REVIEW, deleteExhibit: true });
      assert.equal((await repo.countUsage(media.id)).pendingRevisions, 0);
    });

    it('media khác trong cùng revision không bị tính nhầm', async () => {
      const used = await createMedia();
      const other = await createMedia();
      await createRevision({ imageMediaId: used.id }, { state: RevisionState.APPROVED, publish: true });
      assert.equal((await repo.countUsage(other.id)).publishedExhibits, 0);
    });

    it('chạy được trong transaction (truyền EntityManager)', async () => {
      const media = await createMedia();
      await createRevision({ imageMediaId: media.id }, { state: RevisionState.APPROVED, publish: true });
      const usage = await db.transaction((manager) => repo.countUsage(media.id, manager));
      assert.equal(usage.publishedExhibits, 1);
    });
  });

  describe('lockActiveById', () => {
    it('khóa và trả về media đang hoạt động trong transaction', async () => {
      const media = await createMedia();
      const locked = await db.transaction((manager) => repo.lockActiveById(media.id, manager));
      assert.equal(locked?.id, media.id);
    });

    it('media đã xóa mềm → null', async () => {
      const media = await createMedia({ isDeleted: true, deletedAt: new Date() });
      assert.equal(await db.transaction((manager) => repo.lockActiveById(media.id, manager)), null);
    });

    it('transaction thứ hai phải chờ transaction đang giữ khóa (FOR UPDATE)', async () => {
      const media = await createMedia();
      const order: string[] = [];
      let releaseFirst!: () => void;
      const firstHolding = new Promise<void>((resolve) => (releaseFirst = resolve));
      let firstLocked!: () => void;
      const lockAcquired = new Promise<void>((resolve) => (firstLocked = resolve));

      const first = db.transaction(async (manager) => {
        await repo.lockActiveById(media.id, manager);
        order.push('first-locked');
        firstLocked();
        await firstHolding;
        order.push('first-commit');
      });
      await lockAcquired;
      const second = db.transaction(async (manager) => {
        await repo.lockActiveById(media.id, manager);
        order.push('second-locked');
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.deepEqual(order, ['first-locked'], 'transaction thứ hai không được lấy khóa khi thứ nhất chưa commit');
      releaseFirst();
      await Promise.all([first, second]);
      assert.deepEqual(order, ['first-locked', 'first-commit', 'second-locked']);
    });
  });

  describe('Ràng buộc database', () => {
    it('lưu kind subtitle và trạng thái quarantined (migration mới)', async () => {
      const media = await createMedia({ kind: MediaKind.SUBTITLE, mimeType: 'text/vtt', processingState: MediaProcessingState.QUARANTINED, storageKey: `quarantine/${randomUUID()}.bin` });
      const found = await repo.findActiveById(media.id);
      assert.equal(found?.kind, MediaKind.SUBTITLE);
      assert.equal(found?.processingState, MediaProcessingState.QUARANTINED);
    });

    it('storage_key trùng → database từ chối', async () => {
      const media = await createMedia();
      await assert.rejects(createMedia({ storageKey: media.storageKey }), /duplicate key|unique/i);
    });

    it('created_at tự sinh', async () => {
      const media = await createMedia();
      const found = await repo.findActiveById(media.id);
      assert.ok(found?.createdAt instanceof Date);
    });
  });
});
