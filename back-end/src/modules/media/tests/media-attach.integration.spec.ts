import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { REVISION_MEDIA_SLOTS } from '../../exhibits/constants/revision-media-slots';
import { Exhibit, ExhibitVisibility } from '../../exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../exhibits/entities/exhibit-revision.entity';
import { Hotspot } from '../../exhibits/entities/hotspot.entity';
import { ExhibitsRepository } from '../../exhibits/repositories/exhibits.repository';
import { ExhibitsService } from '../../exhibits/services/exhibits.service';
import { RevisionPublishGate } from '../../exhibits/services/revision-publish.gate';
import { Room, RoomStatus } from '../../rooms/entities/room.entity';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { User } from '../../users/entities/user.entity';
import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaReferenceValidator } from '../services/media-reference.validator';
import { MediaStorageService } from '../services/media-storage.service';
import { LocalStorageDriver } from '../storage/local-storage.driver';
import { MediaService } from '../services/media.service';
import { testMediaUrlService } from './media-test-doubles';

/**
 * Integration Task 9 trên PostgreSQL THẬT (chỉ localhost, xem media-repository.integration).
 * Kiểm tra truy vấn "media công khai", BR-21 cho đủ 6 slot, khóa FOR SHARE và race
 * Submit Review ↔ xóa media qua service thật.
 */
const TEST_DATABASE_URL = process.env.MEDIA_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần MEDIA_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

const KIND_BY_SLOT_KIND: Record<MediaKind, { dir: string; ext: string; mime: string }> = {
  [MediaKind.MODEL]: { dir: 'models', ext: 'glb', mime: 'model/gltf-binary' },
  [MediaKind.IMAGE]: { dir: 'images', ext: 'png', mime: 'image/png' },
  [MediaKind.AUDIO]: { dir: 'audio', ext: 'mp3', mime: 'audio/mpeg' },
  [MediaKind.SUBTITLE]: { dir: 'subtitles', ext: 'vtt', mime: 'text/vtt' },
};

const VALID_CONTENT = {
  name: { vi: 'Bình gốm', en: 'Ceramic vase' },
  description: { vi: 'Mô tả', en: 'Description' },
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

describe('Task 9 — media gắn revision (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let workDir: string;
  let mediaRepo: MediaRepository;
  let exhibitsRepo: ExhibitsRepository;
  let exhibitsService: ExhibitsService;
  let mediaService: MediaService;
  const tag = `itest9-${randomUUID().slice(0, 8)}`;
  const created = { users: [] as string[], rooms: [] as string[], exhibits: [] as string[], revisions: [] as string[], media: [] as string[] };
  let userId: string;
  let roomId: string;

  async function createRoom(overrides: Partial<Room> = {}): Promise<Room> {
    const room = await db.getRepository(Room).save({ slug: `${tag}-${randomUUID().slice(0, 6)}`, name: 'Phòng test', ...overrides });
    created.rooms.push(room.id);
    return room;
  }

  async function createMedia(kind: MediaKind = MediaKind.IMAGE, overrides: Partial<Media> = {}): Promise<Media> {
    const id = randomUUID();
    const format = KIND_BY_SLOT_KIND[kind];
    const media = await db.getRepository(Media).save({
      id,
      kind,
      storageKey: `uploads/${format.dir}/${id}.${format.ext}`,
      mimeType: format.mime,
      sizeBytes: '100',
      checksumSha256: 'a'.repeat(64),
      processingState: MediaProcessingState.READY,
      source: 'Nguồn',
      author: 'Tác giả',
      license: 'CC BY 4.0',
      createdById: userId,
      ...overrides,
    });
    created.media.push(media.id);
    return media;
  }

  interface RevisionOptions {
    state?: RevisionState;
    publish?: boolean;
    visibility?: ExhibitVisibility;
    archived?: boolean;
    deleted?: boolean;
    room?: string;
    content?: object;
  }

  async function createExhibit(slots: Partial<ExhibitRevision>, options: RevisionOptions = {}) {
    const exhibit = await db.getRepository(Exhibit).save({
      roomId: options.room ?? roomId,
      visibility: options.visibility ?? (options.publish ? ExhibitVisibility.VISIBLE : ExhibitVisibility.HIDDEN),
      version: 1,
    });
    created.exhibits.push(exhibit.id);
    const revision = await db.getRepository(ExhibitRevision).save({
      exhibitId: exhibit.id,
      revisionNo: 1,
      state: options.state ?? (options.publish ? RevisionState.APPROVED : RevisionState.DRAFT),
      content: (options.content ?? VALID_CONTENT) as never,
      createdById: userId,
      ...slots,
    });
    created.revisions.push(revision.id);
    const patch: Partial<Exhibit> = {};
    if (options.publish) patch.publishedRevisionId = revision.id;
    if (options.archived) patch.archivedAt = new Date();
    if (options.deleted) Object.assign(patch, { isDeleted: true, deletedAt: new Date() });
    if (Object.keys(patch).length) await db.getRepository(Exhibit).update(exhibit.id, patch);
    return { exhibit, revision };
  }

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    workDir = await mkdtemp(join(tmpdir(), 'media-attach-'));

    mediaRepo = new MediaRepository(db.getRepository(Media));
    exhibitsRepo = new ExhibitsRepository(
      db.getRepository(Exhibit),
      db.getRepository(ExhibitRevision),
      db.getRepository(Hotspot),
    );
    const tx = new TransactionManager(db);
    const references = new MediaReferenceValidator(mediaRepo);
    exhibitsService = new ExhibitsService(
      exhibitsRepo,
      new RoomsRepository(db.getRepository(Room)),
      tx,
      references,
      new RevisionPublishGate(references),
      testMediaUrlService(),
    );
    mediaService = new MediaService(
      mediaRepo,
      new MediaStorageService(new LocalStorageDriver({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'q') })),
      new MediaInspectionService(),
      tx,
      testMediaUrlService(),
    );

    const user = await db.getRepository(User).save({
      email: `${tag}@example.test`,
      passwordHash: 'not-a-real-hash',
      displayName: 'Integration test',
    });
    userId = user.id;
    created.users.push(user.id);
    roomId = (await createRoom()).id;
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.exhibits.length) {
      await db.query('UPDATE exhibits SET published_revision_id = NULL WHERE id = ANY($1)', [created.exhibits]);
      await db.query('DELETE FROM hotspots WHERE revision_id IN (SELECT id FROM exhibit_revisions WHERE exhibit_id = ANY($1))', [created.exhibits]);
      await db.query('DELETE FROM exhibit_revisions WHERE exhibit_id = ANY($1)', [created.exhibits]);
      await db.query('DELETE FROM exhibits WHERE id = ANY($1)', [created.exhibits]);
    }
    if (created.media.length) await db.query('DELETE FROM media WHERE id = ANY($1)', [created.media]);
    if (created.rooms.length) await db.query('DELETE FROM rooms WHERE id = ANY($1)', [created.rooms]);
    if (created.users.length) await db.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
    await db.destroy();
    await rm(workDir, { recursive: true, force: true });
  });

  describe('isPubliclyReferenced (điều kiện phân phối file — FR-68/AC-36)', () => {
    for (const slot of REVISION_MEDIA_SLOTS) {
      it(`media ở slot ${slot.key} của revision published hiện hành → true`, async () => {
        const media = await createMedia(slot.kind);
        await createExhibit({ [slot.column]: media.id }, { publish: true });
        assert.equal(await mediaRepo.isPubliclyReferenced(media.id), true);
      });
    }

    const hiddenCases: Array<[string, RevisionOptions]> = [
      ['chỉ thuộc Draft', { state: RevisionState.DRAFT }],
      ['chỉ thuộc In Review', { state: RevisionState.IN_REVIEW }],
      ['chỉ thuộc Rejected', { state: RevisionState.REJECTED }],
      ['revision published nhưng exhibit đã ẩn (hidden)', { publish: true, visibility: ExhibitVisibility.HIDDEN }],
      ['exhibit đã lưu trữ', { publish: true, archived: true }],
      ['exhibit đã xóa mềm', { publish: true, deleted: true }],
    ];
    for (const [label, options] of hiddenCases) {
      it(`${label} → false`, async () => {
        const media = await createMedia();
        await createExhibit({ imageMediaId: media.id }, options);
        assert.equal(await mediaRepo.isPubliclyReferenced(media.id), false);
      });
    }

    it('phòng đã lưu trữ → false', async () => {
      const room = await createRoom({ status: RoomStatus.ARCHIVED });
      const media = await createMedia();
      await createExhibit({ imageMediaId: media.id }, { publish: true, room: room.id });
      assert.equal(await mediaRepo.isPubliclyReferenced(media.id), false);
    });

    it('phòng đã xóa mềm → false', async () => {
      const room = await createRoom({ isDeleted: true, deletedAt: new Date() });
      const media = await createMedia();
      await createExhibit({ imageMediaId: media.id }, { publish: true, room: room.id });
      assert.equal(await mediaRepo.isPubliclyReferenced(media.id), false);
    });

    it('revision published LỊCH SỬ (đã bị thay bằng bản mới) → false', async () => {
      const oldMedia = await createMedia();
      const { exhibit } = await createExhibit({ imageMediaId: oldMedia.id }, { publish: true });
      const newMedia = await createMedia();
      const next = await db.getRepository(ExhibitRevision).save({
        exhibitId: exhibit.id, revisionNo: 2, state: RevisionState.APPROVED,
        content: VALID_CONTENT as never, createdById: userId, imageMediaId: newMedia.id,
      });
      created.revisions.push(next.id);
      await db.getRepository(Exhibit).update(exhibit.id, { publishedRevisionId: next.id });
      assert.equal(await mediaRepo.isPubliclyReferenced(oldMedia.id), false);
      assert.equal(await mediaRepo.isPubliclyReferenced(newMedia.id), true);
    });

    it('media dùng chung: exhibit A public + exhibit B ẩn → true', async () => {
      const media = await createMedia();
      await createExhibit({ imageMediaId: media.id }, { publish: true });
      await createExhibit({ imageMediaId: media.id }, { publish: true, visibility: ExhibitVisibility.HIDDEN });
      assert.equal(await mediaRepo.isPubliclyReferenced(media.id), true);
    });
  });

  describe('findByRoom khớp điều kiện công khai', () => {
    it('chỉ trả exhibit visible + published + chưa lưu trữ/xóa, nạp đủ 6 slot', async () => {
      const room = await createRoom();
      const media = Object.fromEntries(
        await Promise.all(REVISION_MEDIA_SLOTS.map(async (slot) => [slot.column, (await createMedia(slot.kind)).id])),
      );
      const { exhibit: visible } = await createExhibit(media, { publish: true, room: room.id });
      await createExhibit({}, { publish: true, room: room.id, archived: true });
      await createExhibit({}, { publish: true, room: room.id, deleted: true });
      await createExhibit({}, { publish: true, room: room.id, visibility: ExhibitVisibility.HIDDEN });
      await createExhibit({}, { room: room.id, visibility: ExhibitVisibility.VISIBLE });

      const result = await exhibitsRepo.findByRoom(room.id);
      assert.deepEqual(result.map((item) => item.id), [visible.id]);
      for (const slot of REVISION_MEDIA_SLOTS) {
        assert.equal(result[0].publishedRevision?.[slot.relation]?.id, media[slot.column], slot.key);
      }
    });
  });

  describe('BR-21 — countUsage cho đủ 6 slot', () => {
    for (const slot of REVISION_MEDIA_SLOTS) {
      it(`xóa media ở slot ${slot.key} của revision published → 409`, async () => {
        const media = await createMedia(slot.kind);
        await createExhibit({ [slot.column]: media.id }, { publish: true });
        await assert.rejects(mediaService.remove(media.id), ConflictException);
      });
    }

    it('media chỉ ở Draft → xóa được (hành vi Task 8), Submit sau đó → 422 media_not_found', async () => {
      const media = await createMedia(MediaKind.MODEL);
      const { exhibit } = await createExhibit({ modelMediaId: media.id });
      await mediaService.remove(media.id);
      await assert.rejects(exhibitsService.submitDraftForReview(exhibit.id), (error: unknown) => {
        assert.ok(error instanceof UnprocessableEntityException);
        const body = error.getResponse() as { errors: Array<{ code: string; field: string }> };
        assert.deepEqual(body.errors.map((item) => [item.field, item.code]), [['modelId', 'media_not_found']]);
        return true;
      });
      const revision = await db.getRepository(ExhibitRevision).findOneByOrFail({ exhibitId: exhibit.id });
      assert.equal(revision.state, RevisionState.DRAFT);
    });
  });

  describe('Gắn media qua service (Save Draft)', () => {
    it('create lưu đủ 6 slot; tải lại giữ đúng tham chiếu (AC-32)', async () => {
      const ids = Object.fromEntries(
        await Promise.all(REVISION_MEDIA_SLOTS.map(async (slot) => [slot.dtoField, (await createMedia(slot.kind)).id])),
      );
      const result = await exhibitsService.createExhibitDraft({ roomId, name: { vi: 'A' }, ...ids } as never, { id: userId });
      created.exhibits.push(result.id);
      const revision = await db.getRepository(ExhibitRevision).findOneByOrFail({ exhibitId: result.id });
      for (const slot of REVISION_MEDIA_SLOTS) assert.equal(revision[slot.column], ids[slot.dtoField], slot.key);
    });

    it('media quarantined → 422, không tạo exhibit nào (rollback)', async () => {
      const media = await createMedia(MediaKind.IMAGE, { processingState: MediaProcessingState.QUARANTINED });
      const before = await db.getRepository(Exhibit).countBy({ roomId });
      await assert.rejects(
        exhibitsService.createExhibitDraft({ roomId, imageId: media.id } as never, { id: userId }),
        UnprocessableEntityException,
      );
      assert.equal(await db.getRepository(Exhibit).countBy({ roomId }), before);
    });

    it('update in-place: thay model + tháo ảnh; media cũ vẫn còn', async () => {
      const [oldModel, newModel, image] = [await createMedia(MediaKind.MODEL), await createMedia(MediaKind.MODEL), await createMedia()];
      const { exhibit } = await createExhibit({ modelMediaId: oldModel.id, imageMediaId: image.id });
      const loaded = await exhibitsRepo.findActiveRevision(exhibit.id);
      assert.equal(loaded?.modelMedia?.id, oldModel.id);
      await exhibitsService.updateExhibitDraft(exhibit.id, { modelId: newModel.id, imageId: null } as never, { id: userId });
      const revision = await db.getRepository(ExhibitRevision).findOneByOrFail({ exhibitId: exhibit.id });
      assert.equal(revision.modelMediaId, newModel.id);
      assert.equal(revision.imageMediaId, null);
      assert.equal((await mediaRepo.findActiveById(oldModel.id))?.id, oldModel.id);
    });

    it('update khi đang published → fork revision mới, bản published giữ media cũ (AC-35)', async () => {
      const [oldModel, newModel, audioEn] = [await createMedia(MediaKind.MODEL), await createMedia(MediaKind.MODEL), await createMedia(MediaKind.AUDIO)];
      const { exhibit, revision: published } = await createExhibit({ modelMediaId: oldModel.id, audioEnMediaId: audioEn.id }, { publish: true });
      await exhibitsService.updateExhibitDraft(exhibit.id, { modelId: newModel.id } as never, { id: userId });
      const revisions = await db.getRepository(ExhibitRevision).find({ where: { exhibitId: exhibit.id }, order: { revisionNo: 'ASC' } });
      revisions.forEach((revision) => created.revisions.push(revision.id));
      assert.equal(revisions.length, 2);
      assert.equal(revisions[0].id, published.id);
      assert.equal(revisions[0].modelMediaId, oldModel.id);
      assert.equal(revisions[1].modelMediaId, newModel.id);
      assert.equal(revisions[1].audioEnMediaId, audioEn.id, 'fork giữ slot audio tiếng Anh');
      assert.equal((await db.getRepository(Exhibit).findOneByOrFail({ id: exhibit.id })).publishedRevisionId, published.id);
    });
  });

  describe('Khóa FOR SHARE chặn xóa đồng thời', () => {
    it('xóa media phải chờ transaction đang gắn media kết thúc', async () => {
      const media = await createMedia();
      const events: string[] = [];
      let releaseLock!: () => void;
      const locked = new Promise<void>((resolve) => (releaseLock = resolve));
      let lockAcquired!: () => void;
      const acquired = new Promise<void>((resolve) => (lockAcquired = resolve));

      const holder = db.transaction(async (manager) => {
        await mediaRepo.lockByIds([media.id], manager);
        lockAcquired();
        await locked;
        events.push('attach-commit');
      });
      await acquired;
      const remover = mediaService.remove(media.id).then(() => events.push('delete-done'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.deepEqual(events, [], 'delete chưa được chạy khi khóa còn giữ');
      releaseLock();
      await Promise.all([holder, remover]);
      assert.deepEqual(events, ['attach-commit', 'delete-done']);
    });
  });

  describe('Race Submit Review ↔ xóa media (lặp 15 lần)', () => {
    it('không bao giờ có revision in_review trỏ tới media đã xóa', async () => {
      for (let round = 0; round < 15; round++) {
        const media = await createMedia(MediaKind.MODEL);
        const { exhibit } = await createExhibit({ modelMediaId: media.id });
        const [submit, remove] = await Promise.allSettled([
          exhibitsService.submitDraftForReview(exhibit.id),
          mediaService.remove(media.id),
        ]);
        const revision = await db.getRepository(ExhibitRevision).findOneByOrFail({ exhibitId: exhibit.id });
        const row = await db.getRepository(Media).findOneByOrFail({ id: media.id });
        assert.ok(
          (submit.status === 'fulfilled' && remove.status === 'rejected' && !row.isDeleted && revision.state === RevisionState.IN_REVIEW) ||
            (submit.status === 'rejected' && remove.status === 'fulfilled' && row.isDeleted && revision.state === RevisionState.DRAFT),
          `round ${round}: submit=${submit.status} remove=${remove.status} deleted=${row.isDeleted} state=${revision.state}`,
        );
      }
    });
  });
});
