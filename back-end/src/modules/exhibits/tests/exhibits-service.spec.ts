import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DomainValidationException } from '../../../common/exceptions/validation.exception';
import { DeepPartial, EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { Paginated } from '../../../common/types/paginated.type';
import { Room, RoomStatus } from '../../rooms/entities/room.entity';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { User } from '../../users/entities/user.entity';
import { BilingualDescriptionDto, BilingualNameDto } from '../dto/bilingual-text.dto';
import { CreateExhibitDto } from '../dto/create-exhibit.dto';
import { CreateHotspotDto } from '../dto/hotspot.dto';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import {
  ExhibitRevision,
  ExhibitRevisionContent,
  RevisionState,
} from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { ExhibitsService } from '../services/exhibits.service';

// ============================================================================
// TEST FIXTURES & SAMPLE HELPERS
// ============================================================================

const ROOM_ID_1 = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
const ROOM_ID_2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const EXHIBIT_ID_1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const REV_ID_1 = 'c1d2e3f4-a5b6-7890-cdef-1234567890ab';
const REV_ID_2 = 'd2e3f4a5-b6c7-8901-def1-234567890abc';
const USER_ID_1 = 'f1e2d3c4-b5a6-7890-fedc-ba9876543210';
const USER_ID_2 = 'e2d3c4b5-a6f7-8901-edcb-a98765432109';

function createSampleUser(overrides?: Partial<User>): User {
  const user = new User();
  user.id = overrides?.id ?? USER_ID_1;
  user.displayName = overrides?.displayName ?? 'Nguyễn Văn Editor';
  user.email = overrides?.email ?? 'editor@museum.vn';
  return user;
}

function createSampleRoom(overrides?: Partial<Room>): Room {
  const room = new Room();
  room.id = overrides?.id ?? ROOM_ID_1;
  room.slug = overrides?.slug ?? 'phong-kham-pha';
  room.name = overrides?.name ?? 'Phòng Khám Phá';
  room.description = overrides?.description ?? 'Mô tả phòng khám phá';
  room.status = overrides?.status ?? RoomStatus.ACTIVE;
  room.isDeleted = overrides?.isDeleted ?? false;
  room.deletedAt = overrides?.deletedAt ?? null;
  room.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  room.updatedAt = overrides?.updatedAt ?? new Date('2026-10-10T12:00:00Z');
  room.exhibits = overrides?.exhibits ?? [];
  return room;
}

function createSampleHotspot(overrides?: Partial<Hotspot>): Hotspot {
  const hotspot = new Hotspot();
  hotspot.id = overrides?.id ?? 'h1b2c3d4-e5f6-7890-abcd-ef1234567890';
  hotspot.revisionId = overrides?.revisionId ?? REV_ID_1;
  hotspot.label = overrides?.label ?? 'Điểm chạm đầu rồng';
  hotspot.body = overrides?.body ?? 'Chi tiết hoa văn rồng thời Lý chạm nổi';
  hotspot.positionX = overrides?.positionX ?? '1.5';
  hotspot.positionY = overrides?.positionY ?? '2.0';
  hotspot.positionZ = overrides?.positionZ ?? '-0.5';
  hotspot.displayOrder = overrides?.displayOrder ?? 1;
  return hotspot;
}

function createSampleRevision(
  overrides?: Omit<Partial<ExhibitRevision>, 'createdBy'> & { createdBy?: User | null },
): ExhibitRevision {
  const rev = new ExhibitRevision();
  rev.id = overrides?.id ?? REV_ID_1;
  rev.exhibitId = overrides?.exhibitId ?? EXHIBIT_ID_1;
  rev.revisionNo = overrides?.revisionNo ?? 1;
  rev.state = overrides?.state ?? RevisionState.DRAFT;
  rev.content = (overrides?.content ?? {
    name: { vi: 'Bình gốm hoa nâu', en: 'Brown Flower Ceramic Vase' },
    description: { vi: 'Gốm men thời Lý thế kỷ 11', en: '11th century Ly dynasty ceramic' },
    position: { x: 1, y: 0.5, z: -2 },
    rotation: { x: 0, y: 0.2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    placeholderShape: 'cylinder',
    placeholderColor: '#8b7355',
    transcript: 'Thuyết minh bình gốm thời Lý',
    altText: 'Ảnh chụp chính diện bình gốm',
  }) as unknown as ExhibitRevisionContent;
  rev.modelMediaId = overrides?.modelMediaId ?? null;
  rev.modelMedia = overrides?.modelMedia ?? null;
  rev.imageMediaId = overrides?.imageMediaId ?? null;
  rev.imageMedia = overrides?.imageMedia ?? null;
  rev.audioMediaId = overrides?.audioMediaId ?? null;
  rev.audioMedia = overrides?.audioMedia ?? null;
  rev.createdById = overrides?.createdById ?? USER_ID_1;
  rev.createdBy =
    overrides && 'createdBy' in overrides
      ? (overrides.createdBy as User)
      : createSampleUser({ id: USER_ID_1 });
  rev.reviewedById = overrides?.reviewedById ?? null;
  rev.reviewedBy = overrides?.reviewedBy ?? null;
  rev.reason = overrides?.reason ?? null;
  rev.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  rev.reviewedAt = overrides?.reviewedAt ?? null;
  rev.hotspots = overrides?.hotspots ?? [];
  return rev;
}

function createSampleExhibit(
  overrides?: Omit<Partial<Exhibit>, 'room'> & { room?: Room | null },
): Exhibit {
  const exhibit = new Exhibit();
  exhibit.id = overrides?.id ?? EXHIBIT_ID_1;
  exhibit.roomId = overrides?.roomId ?? ROOM_ID_1;
  exhibit.room =
    overrides && 'room' in overrides
      ? (overrides.room as Room)
      : createSampleRoom({ id: exhibit.roomId });
  exhibit.publishedRevisionId = overrides?.publishedRevisionId ?? null;
  exhibit.publishedRevision = overrides?.publishedRevision ?? null;
  exhibit.visibility = overrides?.visibility ?? ExhibitVisibility.HIDDEN;
  exhibit.version = overrides?.version ?? 1;
  exhibit.displayOrder = overrides?.displayOrder ?? 1;
  exhibit.archivedAt = overrides?.archivedAt ?? null;
  exhibit.isDeleted = overrides?.isDeleted ?? false;
  exhibit.deletedAt = overrides?.deletedAt ?? null;
  exhibit.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  exhibit.updatedAt = overrides?.updatedAt ?? new Date('2026-10-10T12:00:00Z');
  exhibit.revisions = overrides?.revisions ?? [];
  return exhibit;
}

// ============================================================================
// MOCKS
// ============================================================================

class MockTransactionManager {
  calls = 0;
  async run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    this.calls++;
    const fakeManager = {
      getRepository: () => ({
        save: async (x: unknown) => x,
        delete: async () => ({ affected: 1 }),
        update: async () => ({ affected: 1 }),
      }),
    } as unknown as EntityManager;
    return work(fakeManager);
  }
}

class MockRoomsRepository {
  publicRooms: Room[] = [];
  roomBySlug: Room | null = null;
  roomById: Room | null = null;
  findByIdCalls: string[] = [];
  findBySlugCalls: string[] = [];
  findPublicRoomsCalls = 0;

  async findPublicRooms(): Promise<Room[]> {
    this.findPublicRoomsCalls++;
    return this.publicRooms;
  }

  async findBySlug(slug: string): Promise<Room | null> {
    this.findBySlugCalls.push(slug);
    return this.roomBySlug;
  }

  async findById(id: string): Promise<Room | null> {
    this.findByIdCalls.push(id);
    return this.roomById;
  }
}

class MockExhibitsRepository {
  findByRoomResult: Exhibit[] = [];
  findAdminDetailResult: Exhibit | null = null;
  findRevisionsResult: ExhibitRevision[] = [];
  findRevisionByIdResult: ExhibitRevision | null = null;
  latestRevisionNoResult = 1;
  activeRevisionResult: ExhibitRevision | null = null;
  searchAdminResult: Paginated<Exhibit> = { items: [], total: 0, page: 1, pageSize: 20 };
  countByRoomResult = 0;

  savedExhibits: Exhibit[] = [];
  savedRevisions: ExhibitRevision[] = [];
  savedHotspots: Hotspot[] = [];
  deletedHotspotRevisionIds: string[][] = [];
  deletedRevisionExhibitIds: string[] = [];
  deletedRevisionIds: string[] = [];
  deletedCascadeExhibitIds: string[] = [];
  updatedDisplayOrders: { id: string; roomId: string; displayOrder: number }[] = [];
  /** ID hiện vật chưa xóa của phòng mà `findIdsByRoomForUpdate` trả về. */
  roomExhibitIds: string[] = [];
  lockedRoomIds: string[] = [];

  create(data: DeepPartial<Exhibit>): Exhibit {
    const ex = new Exhibit();
    Object.assign(ex, data);
    if (!ex.id) ex.id = EXHIBIT_ID_1;
    return ex;
  }

  async findByRoom(): Promise<Exhibit[]> {
    return this.findByRoomResult;
  }

  async findAdminDetailById(): Promise<Exhibit | null> {
    return this.findAdminDetailResult;
  }

  async findRevisionsByExhibitId(): Promise<ExhibitRevision[]> {
    return this.findRevisionsResult;
  }

  async findRevisionById(): Promise<ExhibitRevision | null> {
    return this.findRevisionByIdResult;
  }

  async findLatestRevisionNo(): Promise<number> {
    return this.latestRevisionNoResult;
  }

  async findActiveRevision(): Promise<ExhibitRevision | null> {
    return this.activeRevisionResult;
  }

  async searchAdminExhibits(): Promise<Paginated<Exhibit>> {
    return this.searchAdminResult;
  }

  async save(entity: Exhibit): Promise<Exhibit> {
    const e = entity instanceof Exhibit ? entity : Object.assign(new Exhibit(), entity);
    if (!e.id) e.id = EXHIBIT_ID_1;
    this.savedExhibits.push(e);
    return e;
  }

  async saveRevision(revision: ExhibitRevision): Promise<ExhibitRevision> {
    const r = revision instanceof ExhibitRevision ? revision : Object.assign(new ExhibitRevision(), revision);
    if (!r.id) r.id = REV_ID_1;
    this.savedRevisions.push(r);
    return r;
  }

  async saveHotspots(hotspots: Hotspot[]): Promise<Hotspot[]> {
    this.savedHotspots.push(...hotspots);
    return hotspots.map((h, i) => {
      const hs = Object.assign(new Hotspot(), h);
      if (!hs.id) hs.id = `hotspot-${i + 1}`;
      return hs;
    });
  }

  async deleteHotspotsByRevisionIds(ids: string[]): Promise<void> {
    this.deletedHotspotRevisionIds.push(ids);
  }

  async deleteRevisionsByExhibitId(exhibitId: string): Promise<void> {
    this.deletedRevisionExhibitIds.push(exhibitId);
  }

  async deleteRevisionById(revisionId: string): Promise<void> {
    this.deletedRevisionIds.push(revisionId);
  }

  async deleteCascadeDraft(exhibitId: string): Promise<void> {
    this.deletedCascadeExhibitIds.push(exhibitId);
  }

  async countByRoom(): Promise<number> {
    return this.countByRoomResult;
  }

  async findIdsByRoomForUpdate(roomId: string): Promise<string[]> {
    this.lockedRoomIds.push(roomId);
    return [...this.roomExhibitIds];
  }

  async updateDisplayOrder(id: string, roomId: string, displayOrder: number): Promise<void> {
    this.updatedDisplayOrders.push({ id, roomId, displayOrder });
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Task 7.3 — ExhibitsService Comprehensive Test Suite (120 Test Cases)', () => {
  let service: ExhibitsService;
  let mockExhibits: MockExhibitsRepository;
  let mockRooms: MockRoomsRepository;
  let mockTx: MockTransactionManager;

  function setup() {
    mockExhibits = new MockExhibitsRepository();
    mockRooms = new MockRoomsRepository();
    mockTx = new MockTransactionManager();
    service = new ExhibitsService(
      mockExhibits as unknown as ExhibitsRepository,
      mockRooms as unknown as RoomsRepository,
      mockTx as unknown as TransactionManager,
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 1: PUBLIC VISITOR EXPERIENCE (15 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 1: Public Visitor Experience (15 Test Cases)', () => {
    it('TC-S001: roomsList returns empty list when no active rooms exist', async () => {
      setup();
      mockRooms.publicRooms = [];
      const res = await service.roomsList();
      assert.deepEqual(res, []);
      assert.equal(mockRooms.findPublicRoomsCalls, 1);
    });

    it('TC-S002: roomsList returns active public rooms', async () => {
      setup();
      mockRooms.publicRooms = [createSampleRoom()];
      const res = await service.roomsList();
      assert.equal(res.length, 1);
      assert.equal(res[0].slug, 'phong-kham-pha');
    });

    it('TC-S003: roomWithExhibits throws NotFoundException when room does not exist', async () => {
      setup();
      mockRooms.roomBySlug = null;
      await assert.rejects(
        () => service.roomWithExhibits('non-existent-room'),
        (err: Error) => err instanceof NotFoundException && err.message.includes('Không tìm thấy'),
      );
    });

    it('TC-S004: roomWithExhibits throws NotFoundException when room is deleted', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom({ isDeleted: true });
      await assert.rejects(
        () => service.roomWithExhibits('phong-kham-pha'),
        NotFoundException,
      );
    });

    it('TC-S005: roomWithExhibits throws NotFoundException when room is archived', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom({ status: RoomStatus.ARCHIVED });
      await assert.rejects(
        () => service.roomWithExhibits('phong-kham-pha'),
        NotFoundException,
      );
    });

    it('TC-S006: roomWithExhibits returns empty exhibits array when room has no exhibits', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      mockExhibits.findByRoomResult = [];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.name, 'Phòng Khám Phá');
      assert.deepEqual(res.exhibits, []);
    });

    it('TC-S007: roomWithExhibits filters out exhibits without publishedRevision', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: null })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits.length, 0);
    });

    it('TC-S008: roomWithExhibits filters out exhibits whose revision state is DRAFT', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const rev = createSampleRevision({ state: RevisionState.DRAFT });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits.length, 0);
    });

    it('TC-S009: roomWithExhibits filters out exhibits whose revision state is IN_REVIEW', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const rev = createSampleRevision({ state: RevisionState.IN_REVIEW });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits.length, 0);
    });

    it('TC-S010: roomWithExhibits filters out exhibits whose revision state is REJECTED', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const rev = createSampleRevision({ state: RevisionState.REJECTED });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits.length, 0);
    });

    it('TC-S011: roomWithExhibits includes exhibits whose revision state is APPROVED', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const rev = createSampleRevision({ state: RevisionState.APPROVED });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits.length, 1);
      assert.equal(res.exhibits[0].id, EXHIBIT_ID_1);
    });

    it('TC-S012: roomWithExhibits maps coordinates from JSONB content', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const rev = createSampleRevision({
        state: RevisionState.APPROVED,
        content: {
          name: 'Hiện vật A',
          description: 'Mô tả A',
          position: { x: 3.5, y: 1.2, z: -4.8 },
        } as unknown as ExhibitRevisionContent,
      });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits[0].positionX, 3.5);
      assert.equal(res.exhibits[0].positionY, 1.2);
      assert.equal(res.exhibits[0].positionZ, -4.8);
    });

    it('TC-S013: roomWithExhibits sorts hotspots by displayOrder ascending', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const h1 = createSampleHotspot({ id: 'h1', displayOrder: 3 });
      const h2 = createSampleHotspot({ id: 'h2', displayOrder: 1 });
      const rev = createSampleRevision({
        state: RevisionState.APPROVED,
        hotspots: [h1, h2],
      });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits[0].hotspots.length, 2);
      assert.equal(res.exhibits[0].hotspots[0].id, 'h2');
      assert.equal(res.exhibits[0].hotspots[1].id, 'h1');
    });

    it('TC-S014: roomWithExhibits defaults placeholder shape and color if missing', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const rev = createSampleRevision({
        state: RevisionState.APPROVED,
        content: { name: 'A', description: 'B', position: { x: 0, y: 0, z: 0 } } as unknown as ExhibitRevisionContent,
      });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits[0].placeholderShape, 'box');
      assert.equal(res.exhibits[0].placeholderColor, '#8b7355');
    });

    it('TC-S015: roomWithExhibits preserves transcript and media null placeholders', async () => {
      setup();
      mockRooms.roomBySlug = createSampleRoom();
      const rev = createSampleRevision({
        state: RevisionState.APPROVED,
        content: {
          name: 'A',
          description: 'B',
          position: { x: 0, y: 0, z: 0 },
          transcript: 'Bản dịch thuyết minh',
        } as unknown as ExhibitRevisionContent,
      });
      mockExhibits.findByRoomResult = [createSampleExhibit({ publishedRevision: rev })];
      const res = await service.roomWithExhibits('phong-kham-pha');
      assert.equal(res.exhibits[0].transcript, 'Bản dịch thuyết minh');
      assert.equal(res.exhibits[0].model, null);
      assert.equal(res.exhibits[0].image, null);
      assert.equal(res.exhibits[0].audio, null);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: ADMIN CMS SEARCH & DETAIL QUERIES (15 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 2: Admin CMS Search & Queries (15 Test Cases)', () => {
    it('TC-S016: searchAdminExhibits delegates query to repository and returns paginated response', async () => {
      setup();
      const exhibit = createSampleExhibit();
      mockExhibits.searchAdminResult = { items: [exhibit], total: 1, page: 1, pageSize: 20 };
      const q = new ListExhibitsQueryDto();
      const res = await service.searchAdminExhibits(q);
      assert.equal(res.total, 1);
      assert.equal(res.items.length, 1);
    });

    it('TC-S017: searchAdminExhibits transforms entities using toExhibitResponse', async () => {
      setup();
      const exhibit = createSampleExhibit({
        publishedRevisionId: REV_ID_1,
        visibility: ExhibitVisibility.VISIBLE,
      });
      mockExhibits.searchAdminResult = { items: [exhibit], total: 1, page: 1, pageSize: 20 };
      const res = await service.searchAdminExhibits(new ListExhibitsQueryDto());
      assert.equal(res.items[0].status, 'published');
      assert.equal(res.items[0].id, EXHIBIT_ID_1);
    });

    it('TC-S018: searchAdminExhibits handles empty search results cleanly', async () => {
      setup();
      mockExhibits.searchAdminResult = { items: [], total: 0, page: 2, pageSize: 10 };
      const res = await service.searchAdminExhibits(new ListExhibitsQueryDto());
      assert.equal(res.total, 0);
      assert.deepEqual(res.items, []);
    });

    it('TC-S019: getAdminDetail throws NotFoundException when exhibit does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = null;
      await assert.rejects(
        () => service.getAdminDetail('non-existent-id'),
        NotFoundException,
      );
    });

    it('TC-S020: getAdminDetail throws NotFoundException when exhibit has isDeleted = true', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ isDeleted: true });
      await assert.rejects(
        () => service.getAdminDetail(EXHIBIT_ID_1),
        NotFoundException,
      );
    });

    it('TC-S021: getAdminDetail returns exhibit details with room information', async () => {
      setup();
      const room = createSampleRoom({ id: ROOM_ID_1, name: 'Phòng Cổ Vật', slug: 'phong-co-vat' });
      mockExhibits.findAdminDetailResult = createSampleExhibit({ room });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.room?.name, 'Phòng Cổ Vật');
      assert.equal(res.room?.slug, 'phong-co-vat');
    });

    it('TC-S022: getAdminDetail handles null room gracefully', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ room: null });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.room, null);
    });

    it('TC-S023: getAdminDetail picks latest revision by revisionNo when revisions exist', async () => {
      setup();
      const rev1 = createSampleRevision({ id: REV_ID_1, revisionNo: 1 });
      const rev2 = createSampleRevision({ id: REV_ID_2, revisionNo: 2 });
      mockExhibits.findAdminDetailResult = createSampleExhibit({ revisions: [rev1, rev2] });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.currentRevisionNo, 2);
    });

    it('TC-S024: getAdminDetail falls back to publishedRevision when revisions array is empty', async () => {
      setup();
      const pubRev = createSampleRevision({ revisionNo: 5, state: RevisionState.APPROVED });
      mockExhibits.findAdminDetailResult = createSampleExhibit({
        revisions: [],
        publishedRevision: pubRev,
      });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.currentRevisionNo, 5);
      assert.equal(res.revisionState, RevisionState.APPROVED);
    });

    it('TC-S025: getAdminDetail maps hotspots with numeric coordinates', async () => {
      setup();
      const h = createSampleHotspot({ positionX: '1.25', positionY: '3.4', positionZ: '-0.8' });
      const rev = createSampleRevision({ hotspots: [h] });
      mockExhibits.findAdminDetailResult = createSampleExhibit({ revisions: [rev] });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.hotspots.length, 1);
      assert.equal(res.hotspots[0].position.x, 1.25);
      assert.equal(res.hotspots[0].position.y, 3.4);
      assert.equal(res.hotspots[0].position.z, -0.8);
    });

    it('TC-S026: getAdminDetail handles empty hotspots array', async () => {
      setup();
      const rev = createSampleRevision({ hotspots: [] });
      mockExhibits.findAdminDetailResult = createSampleExhibit({ revisions: [rev] });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.deepEqual(res.hotspots, []);
    });

    it('TC-S027: getAdminDetail maps full revisions history list with createdBy displayName', async () => {
      setup();
      const rev = createSampleRevision();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ revisions: [rev] });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.revisions.length, 1);
      assert.equal(res.revisions[0].createdBy?.name, 'Nguyễn Văn Editor');
      assert.equal(res.revisions[0].createdBy?.email, 'editor@museum.vn');
    });

    it('TC-S028: getAdminDetail maps reviewedBy user displayName and reason', async () => {
      setup();
      const rev = createSampleRevision({
        reviewedById: USER_ID_2,
        reviewedBy: createSampleUser({ id: USER_ID_2, displayName: 'Trần Thị Moderator', email: 'mod@museum.vn' }),
        reason: 'Nội dung đạt chuẩn chất lượng',
      });
      mockExhibits.findAdminDetailResult = createSampleExhibit({ revisions: [rev] });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.revisions[0].reviewedBy?.name, 'Trần Thị Moderator');
      assert.equal(res.revisions[0].reason, 'Nội dung đạt chuẩn chất lượng');
    });

    it('TC-S029: getAdminDetail handles null createdBy and reviewedBy', async () => {
      setup();
      const rev = createSampleRevision({ createdBy: null, reviewedBy: null });
      mockExhibits.findAdminDetailResult = createSampleExhibit({ revisions: [rev] });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.revisions[0].createdBy, null);
      assert.equal(res.revisions[0].reviewedBy, null);
    });

    it('TC-S030: getAdminDetail correctly computes status published vs draft', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({
        publishedRevisionId: REV_ID_1,
        visibility: ExhibitVisibility.VISIBLE,
      });
      const res = await service.getAdminDetail(EXHIBIT_ID_1);
      assert.equal(res.status, 'published');
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: ADMIN CMS — createExhibitDraft (15 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 3: Admin CMS — createExhibitDraft (15 Test Cases)', () => {
    it('TC-S031: createExhibitDraft throws NotFoundException when room does not exist', async () => {
      setup();
      mockRooms.roomById = null;
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await assert.rejects(
        () => service.createExhibitDraft(dto, { id: USER_ID_1 }),
        NotFoundException,
      );
    });

    it('TC-S032: createExhibitDraft throws NotFoundException when room is soft-deleted', async () => {
      setup();
      mockRooms.roomById = createSampleRoom({ isDeleted: true });
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await assert.rejects(
        () => service.createExhibitDraft(dto, { id: USER_ID_1 }),
        NotFoundException,
      );
    });

    it('TC-S033: createExhibitDraft creates exhibit with visibility HIDDEN', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].visibility, ExhibitVisibility.HIDDEN);
    });

    it('TC-S034: createExhibitDraft initializes exhibit with version: 1 and publishedRevisionId: null', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].version, 1);
      assert.equal(mockExhibits.savedExhibits[0].publishedRevisionId, null);
    });

    it('TC-S035: createExhibitDraft creates initial revision with revisionNo: 1', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].revisionNo, 1);
    });

    it('TC-S036: createExhibitDraft sets initial revision state to DRAFT', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].state, RevisionState.DRAFT);
    });

    it('TC-S037: createExhibitDraft sets createdById to user ID', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].createdById, USER_ID_1);
    });

    it('TC-S038: createExhibitDraft calculates next displayOrder when not specified', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      mockExhibits.countByRoomResult = 4;
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      dto.displayOrder = undefined;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].displayOrder, 5);
    });

    it('TC-S039: createExhibitDraft uses explicit displayOrder when provided', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      dto.displayOrder = 10;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].displayOrder, 10);
    });

    it('TC-S040: createExhibitDraft maps bilingual name object into JSONB content', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      dto.name = { vi: 'Trống đồng Đông Sơn', en: 'Dong Son Bronze Drum' } as unknown as BilingualNameDto;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      const name = content.name as { vi: string; en: string };
      assert.equal(name.vi, 'Trống đồng Đông Sơn');
      assert.equal(name.en, 'Dong Son Bronze Drum');
    });

    it('TC-S041: createExhibitDraft maps bilingual description object into JSONB content', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      dto.description = { vi: 'Niên đại 2000 năm', en: '2000 years old' } as unknown as BilingualDescriptionDto;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      const desc = content.description as { vi: string };
      assert.equal(desc.vi, 'Niên đại 2000 năm');
    });

    it('TC-S042: createExhibitDraft maps 3D transform into JSONB content', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      dto.positionX = 2;
      dto.positionY = 1;
      dto.positionZ = -3;
      dto.scaleX = 2;
      dto.scaleY = 2;
      dto.scaleZ = 2;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      assert.deepEqual(content.position, { x: 2, y: 1, z: -3 });
      assert.deepEqual(content.scale, { x: 2, y: 2, z: 2 });
    });

    it('TC-S043: createExhibitDraft sets placeholderShape and placeholderColor from DTO', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      dto.placeholderShape = 'sphere';
      dto.placeholderColor = '#123456';
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      assert.equal(content.placeholderShape, 'sphere');
      assert.equal(content.placeholderColor, '#123456');
    });

    it('TC-S044: createExhibitDraft creates and links hotspots when provided in DTO', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      const hs = new CreateHotspotDto();
      hs.labelPlain = 'Hotspot 1';
      hs.positionX = 1;
      hs.positionY = 2;
      hs.positionZ = 3;
      hs.displayOrder = 1;
      dto.hotspots = [hs];
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedHotspots.length, 1);
      assert.equal(mockExhibits.savedHotspots[0].positionX, '1');
    });

    it('TC-S045: createExhibitDraft runs all creation operations inside database transaction', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const dto = new CreateExhibitDto();
      dto.roomId = ROOM_ID_1;
      await service.createExhibitDraft(dto, { id: USER_ID_1 });
      assert.equal(mockTx.calls, 1);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: ADMIN CMS — updateExhibitDraft on Draft / Rejected (15 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 4: Admin CMS — updateExhibitDraft on Draft / Rejected (15 Test Cases)', () => {
    it('TC-S046: updateExhibitDraft throws NotFoundException when exhibit does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = null;
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 }),
        NotFoundException,
      );
    });

    it('TC-S047: updateExhibitDraft throws NotFoundException when exhibit is soft-deleted', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ isDeleted: true });
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 }),
        NotFoundException,
      );
    });

    it('TC-S048: updateExhibitDraft throws NotFoundException when new roomId does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ roomId: ROOM_ID_1 });
      mockRooms.roomById = null;
      const dto = new UpdateExhibitDto();
      dto.roomId = ROOM_ID_2;
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 }),
        NotFoundException,
      );
    });

    it('TC-S049: updateExhibitDraft throws NotFoundException when new roomId is soft-deleted', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ roomId: ROOM_ID_1 });
      mockRooms.roomById = createSampleRoom({ id: ROOM_ID_2, isDeleted: true });
      const dto = new UpdateExhibitDto();
      dto.roomId = ROOM_ID_2;
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 }),
        NotFoundException,
      );
    });

    it('TC-S050: updateExhibitDraft allows updating roomId when new room is valid', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ roomId: ROOM_ID_1 });
      mockRooms.roomById = createSampleRoom({ id: ROOM_ID_2, isDeleted: false });
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      const dto = new UpdateExhibitDto();
      dto.roomId = ROOM_ID_2;
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].roomId, ROOM_ID_2);
    });

    it('TC-S051: updateExhibitDraft throws NotFoundException when no active revision exists', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = null;
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 }),
        NotFoundException,
      );
    });

    it('TC-S052: updateExhibitDraft increments exhibit version upon update', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ version: 3 });
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].version, 4);
    });

    it('TC-S053: updateExhibitDraft updates exhibit displayOrder when provided', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ displayOrder: 1 });
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      const dto = new UpdateExhibitDto();
      dto.displayOrder = 7;
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].displayOrder, 7);
    });

    it('TC-S054: updateExhibitDraft merges updated name while keeping existing description', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.DRAFT,
        content: { name: 'Tên Cũ', description: 'Mô Tả Cũ' } as unknown as ExhibitRevisionContent,
      });
      const dto = new UpdateExhibitDto();
      dto.name = 'Tên Mới' as unknown as BilingualNameDto;
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      assert.equal(content.name, 'Tên Mới');
      assert.equal(content.description, 'Mô Tả Cũ');
    });

    it('TC-S055: updateExhibitDraft merges updated description while keeping existing name', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.DRAFT,
        content: { name: 'Tên Cũ', description: 'Mô Tả Cũ' } as unknown as ExhibitRevisionContent,
      });
      const dto = new UpdateExhibitDto();
      dto.description = 'Mô Tả Mới' as unknown as BilingualDescriptionDto;
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      assert.equal(content.name, 'Tên Cũ');
      assert.equal(content.description, 'Mô Tả Mới');
    });

    it('TC-S056: updateExhibitDraft merges updated position while keeping existing rotation', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.DRAFT,
        content: {
          position: { x: 1, y: 1, z: 1 },
          rotation: { x: 0.5, y: 0.5, z: 0.5 },
        } as unknown as ExhibitRevisionContent,
      });
      const dto = new UpdateExhibitDto();
      dto.positionX = 9.9;
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      const pos = content.position as { x: number };
      const rot = content.rotation as { x: number };
      assert.equal(pos.x, 9.9);
      assert.equal(rot.x, 0.5);
    });

    it('TC-S057: updateExhibitDraft resets REJECTED state back to DRAFT (BR-26)', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.REJECTED });
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].state, RevisionState.DRAFT);
    });

    it('TC-S058: updateExhibitDraft preserves DRAFT state when editing draft', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].state, RevisionState.DRAFT);
    });

    it('TC-S059: updateExhibitDraft deletes previous hotspots and saves new hotspots when provided', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ id: REV_ID_1, state: RevisionState.DRAFT });
      const dto = new UpdateExhibitDto();
      const hs = new CreateHotspotDto();
      hs.labelPlain = 'Hotspot Mới';
      hs.positionX = 2;
      hs.positionY = 0;
      hs.positionZ = 0;
      hs.displayOrder = 1;
      dto.hotspots = [hs];
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.deepEqual(mockExhibits.deletedHotspotRevisionIds, [[REV_ID_1]]);
      assert.equal(mockExhibits.savedHotspots.length, 1);
      assert.equal(mockExhibits.savedHotspots[0].positionX, '2');
    });

    it('TC-S060: updateExhibitDraft clears hotspots when empty hotspots array is provided', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ id: REV_ID_1, state: RevisionState.DRAFT });
      const dto = new UpdateExhibitDto();
      dto.hotspots = [];
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.deepEqual(mockExhibits.deletedHotspotRevisionIds, [[REV_ID_1]]);
      assert.equal(mockExhibits.savedHotspots.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 5: ADMIN CMS — updateExhibitDraft with BR-21 (Immutability) (10 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 5: Admin CMS — updateExhibitDraft with BR-21 (10 Test Cases)', () => {
    it('TC-S061: updateExhibitDraft does NOT modify an APPROVED revision in place', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      const approvedRev = createSampleRevision({ id: REV_ID_1, revisionNo: 1, state: RevisionState.APPROVED });
      mockExhibits.activeRevisionResult = approvedRev;
      mockExhibits.latestRevisionNoResult = 1;
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.notEqual(mockExhibits.savedRevisions[0].revisionNo, 1);
    });

    it('TC-S062: updateExhibitDraft forks a new revision with revisionNo = latest + 1 when active is APPROVED', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      const approvedRev = createSampleRevision({ revisionNo: 3, state: RevisionState.APPROVED });
      mockExhibits.activeRevisionResult = approvedRev;
      mockExhibits.latestRevisionNoResult = 3;
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].revisionNo, 4);
    });

    it('TC-S063: updateExhibitDraft sets state of forked revision to DRAFT', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.APPROVED });
      mockExhibits.latestRevisionNoResult = 1;
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].state, RevisionState.DRAFT);
    });

    it('TC-S064: updateExhibitDraft assigns createdById of forked revision to current user', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.APPROVED, createdById: USER_ID_2 });
      mockExhibits.latestRevisionNoResult = 1;
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].createdById, USER_ID_1);
    });

    it('TC-S065: updateExhibitDraft inherits previous content for unmodified fields in forked revision', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.APPROVED,
        content: { name: 'Tên Gốc', description: 'Mô Tả Gốc' } as unknown as ExhibitRevisionContent,
      });
      mockExhibits.latestRevisionNoResult = 1;
      const dto = new UpdateExhibitDto();
      dto.placeholderShape = 'torus';
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      assert.equal(content.name, 'Tên Gốc');
      assert.equal(content.description, 'Mô Tả Gốc');
      assert.equal(content.placeholderShape, 'torus');
    });

    it('TC-S066: updateExhibitDraft applies updated DTO fields into forked revision', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.APPROVED });
      mockExhibits.latestRevisionNoResult = 1;
      const dto = new UpdateExhibitDto();
      dto.name = 'Tên Hoàn Toàn Mới' as unknown as BilingualNameDto;
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      assert.equal(content.name, 'Tên Hoàn Toàn Mới');
    });

    it('TC-S067: updateExhibitDraft clones previous hotspots into forked revision when DTO does not specify hotspots', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      const h = createSampleHotspot({ label: 'Hotspot Cũ', positionX: '1.0' });
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.APPROVED,
        hotspots: [h],
      });
      mockExhibits.latestRevisionNoResult = 1;
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedHotspots.length, 1);
      assert.equal(mockExhibits.savedHotspots[0].label, 'Hotspot Cũ');
    });

    it('TC-S068: updateExhibitDraft replaces hotspots in forked revision when DTO specifies new hotspots', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      const h = createSampleHotspot({ label: 'Hotspot Cũ' });
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.APPROVED,
        hotspots: [h],
      });
      mockExhibits.latestRevisionNoResult = 1;
      const dto = new UpdateExhibitDto();
      const hs = new CreateHotspotDto();
      hs.labelPlain = 'Hotspot Độc Quyền';
      dto.hotspots = [hs];
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedHotspots.length, 1);
    });

    it('TC-S069: updateExhibitDraft does NOT change publishedRevisionId when forking new draft', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: REV_ID_1 });
      mockExhibits.activeRevisionResult = createSampleRevision({ id: REV_ID_1, state: RevisionState.APPROVED });
      mockExhibits.latestRevisionNoResult = 1;
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].publishedRevisionId, REV_ID_1);
    });

    it('TC-S070: updateExhibitDraft preserves public visibility of exhibit while creating new draft', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ visibility: ExhibitVisibility.VISIBLE });
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.APPROVED });
      mockExhibits.latestRevisionNoResult = 1;
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedExhibits[0].visibility, ExhibitVisibility.VISIBLE);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 6: ADMIN CMS — updateExhibitDraft with BR-26 & Conflict Guards (10 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 6: Admin CMS — updateExhibitDraft with BR-26 & Guards (10 Test Cases)', () => {
    it('TC-S071: updateExhibitDraft throws ConflictException when active revision is IN_REVIEW', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.IN_REVIEW });
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 }),
        ConflictException,
      );
    });

    it('TC-S072: updateExhibitDraft error message explicitly informs content is in moderation', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.IN_REVIEW });
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 }),
        (err: Error) => err instanceof ConflictException && err.message.includes('quá trình kiểm duyệt'),
      );
    });

    it('TC-S073: updateExhibitDraft does NOT perform DB updates when in_review conflict occurs', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.IN_REVIEW });
      await assert.rejects(
        () => service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 }),
        ConflictException,
      );
      assert.equal(mockExhibits.savedExhibits.length, 0);
      assert.equal(mockExhibits.savedRevisions.length, 0);
    });

    it('TC-S074: updateExhibitDraft handles updates without changing media IDs', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.DRAFT,
        modelMediaId: 'mod-1',
      });
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].modelMediaId, 'mod-1');
    });

    it('TC-S075: updateExhibitDraft updates modelMediaId when modelId is passed in DTO', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      const dto = new UpdateExhibitDto();
      dto.modelId = 'new-model-uuid';
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].modelMediaId, 'new-model-uuid');
    });

    it('TC-S076: updateExhibitDraft clears modelMediaId when modelId: null is passed', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({
        state: RevisionState.DRAFT,
        modelMediaId: 'old-model',
      });
      const dto = new UpdateExhibitDto();
      dto.modelId = null;
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].modelMediaId, null);
    });

    it('TC-S077: updateExhibitDraft updates imageMediaId and audioMediaId when passed', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      const dto = new UpdateExhibitDto();
      dto.imageId = 'img-1';
      dto.audioId = 'aud-1';
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      assert.equal(mockExhibits.savedRevisions[0].imageMediaId, 'img-1');
      assert.equal(mockExhibits.savedRevisions[0].audioMediaId, 'aud-1');
    });

    it('TC-S078: updateExhibitDraft updates transcript and altText when passed', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      const dto = new UpdateExhibitDto();
      dto.transcriptPlain = 'Lời thoại mới';
      dto.altTextPlain = 'Alt text mới';
      await service.updateExhibitDraft(EXHIBIT_ID_1, dto, { id: USER_ID_1 });
      const content = mockExhibits.savedRevisions[0].content as unknown as Record<string, unknown>;
      assert.equal(content.transcript, 'Lời thoại mới');
      assert.equal(content.altText, 'Alt text mới');
    });

    it('TC-S079: updateExhibitDraft executes all mutations atomically within tx.run', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(mockTx.calls, 1);
    });

    it('TC-S080: updateExhibitDraft returns mapped ExhibitAdminResponse reflecting changes', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      const res = await service.updateExhibitDraft(EXHIBIT_ID_1, new UpdateExhibitDto(), { id: USER_ID_1 });
      assert.equal(res.id, EXHIBIT_ID_1);
      assert.equal(res.revisionState, RevisionState.DRAFT);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 7: ADMIN CMS — submitDraftForReview (10 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 7: Admin CMS — submitDraftForReview (10 Test Cases)', () => {
    it('TC-S081: submitDraftForReview throws NotFoundException when exhibit does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = null;
      await assert.rejects(
        () => service.submitDraftForReview('non-existent-id'),
        NotFoundException,
      );
    });

    it('TC-S082: submitDraftForReview throws NotFoundException when exhibit is deleted', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ isDeleted: true });
      await assert.rejects(
        () => service.submitDraftForReview(EXHIBIT_ID_1),
        NotFoundException,
      );
    });

    it('TC-S083: submitDraftForReview throws NotFoundException when no active revision exists', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = null;
      await assert.rejects(
        () => service.submitDraftForReview(EXHIBIT_ID_1),
        NotFoundException,
      );
    });

    it('TC-S084: submitDraftForReview throws ConflictException when active revision is already IN_REVIEW', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.IN_REVIEW });
      await assert.rejects(
        () => service.submitDraftForReview(EXHIBIT_ID_1),
        (err: Error) => err instanceof ConflictException && err.message.includes('trước đó'),
      );
    });

    it('TC-S085: submitDraftForReview throws ConflictException when active revision is APPROVED', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.APPROVED });
      await assert.rejects(
        () => service.submitDraftForReview(EXHIBIT_ID_1),
        (err: Error) => err instanceof ConflictException && err.message.includes('Không có bản nháp nào'),
      );
    });

    it('TC-S086: submitDraftForReview transitions state from DRAFT to IN_REVIEW', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      await service.submitDraftForReview(EXHIBIT_ID_1);
      assert.equal(mockExhibits.savedRevisions[0].state, RevisionState.IN_REVIEW);
    });

    it('TC-S087: submitDraftForReview transitions state from REJECTED to IN_REVIEW', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.REJECTED });
      await service.submitDraftForReview(EXHIBIT_ID_1);
      assert.equal(mockExhibits.savedRevisions[0].state, RevisionState.IN_REVIEW);
    });

    it('TC-S088: submitDraftForReview increments exhibit version', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ version: 2 });
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      await service.submitDraftForReview(EXHIBIT_ID_1);
      assert.equal(mockExhibits.savedExhibits[0].version, 3);
    });

    it('TC-S089: submitDraftForReview saves revision and exhibit inside a transaction', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      await service.submitDraftForReview(EXHIBIT_ID_1);
      assert.equal(mockTx.calls, 1);
    });

    it('TC-S090: submitDraftForReview returns updated exhibit response with revisionState: in_review', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.activeRevisionResult = createSampleRevision({ state: RevisionState.DRAFT });
      const res = await service.submitDraftForReview(EXHIBIT_ID_1);
      assert.equal(res.revisionState, RevisionState.IN_REVIEW);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 8: ADMIN CMS — deleteExhibitDraft & BR-20 (10 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 8: Admin CMS — deleteExhibitDraft & BR-20 (10 Test Cases)', () => {
    it('TC-S091: deleteExhibitDraft throws NotFoundException when exhibit does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = null;
      await assert.rejects(
        () => service.deleteExhibitDraft('non-existent-id'),
        NotFoundException,
      );
    });

    it('TC-S092: deleteExhibitDraft throws NotFoundException when exhibit is soft-deleted', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ isDeleted: true });
      await assert.rejects(
        () => service.deleteExhibitDraft(EXHIBIT_ID_1),
        NotFoundException,
      );
    });

    it('TC-S093: deleteExhibitDraft throws ConflictException when exhibit has publishedRevisionId !== null (BR-20)', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: REV_ID_1 });
      await assert.rejects(
        () => service.deleteExhibitDraft(EXHIBIT_ID_1),
        ConflictException,
      );
    });

    it('TC-S094: deleteExhibitDraft throws ConflictException when exhibit has visibility: VISIBLE (BR-20)', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({
        publishedRevisionId: null,
        visibility: ExhibitVisibility.VISIBLE,
      });
      await assert.rejects(
        () => service.deleteExhibitDraft(EXHIBIT_ID_1),
        ConflictException,
      );
    });

    it('TC-S095: deleteExhibitDraft error message guides user to hide/unpublish first', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: REV_ID_1 });
      await assert.rejects(
        () => service.deleteExhibitDraft(EXHIBIT_ID_1),
        (err: Error) => err instanceof ConflictException && err.message.includes('ẩn (Hide/Unpublish)'),
      );
    });

    it('TC-S096: deleteExhibitDraft calls deleteCascadeDraft in transaction when exhibit is purely draft', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({
        publishedRevisionId: null,
        visibility: ExhibitVisibility.HIDDEN,
      });
      await service.deleteExhibitDraft(EXHIBIT_ID_1);
      assert.deepEqual(mockExhibits.deletedCascadeExhibitIds, [EXHIBIT_ID_1]);
    });

    it('TC-S097: deleteExhibitDraft succeeds when exhibit has no published revision and visibility: HIDDEN', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({
        publishedRevisionId: null,
        visibility: ExhibitVisibility.HIDDEN,
      });
      const res = await service.deleteExhibitDraft(EXHIBIT_ID_1);
      assert.equal(res.success, true);
    });

    it('TC-S098: deleteExhibitDraft returns success object with message', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({
        publishedRevisionId: null,
        visibility: ExhibitVisibility.HIDDEN,
      });
      const res = await service.deleteExhibitDraft(EXHIBIT_ID_1);
      assert.equal(res.success, true);
      assert.ok(res.message.includes('thành công'));
    });

    it('TC-S099: deleteExhibitDraft executes cascade deletion inside tx.run', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({
        publishedRevisionId: null,
        visibility: ExhibitVisibility.HIDDEN,
      });
      await service.deleteExhibitDraft(EXHIBIT_ID_1);
      assert.equal(mockTx.calls, 1);
    });

    it('TC-S100: deleteExhibitDraft does not call deleteCascadeDraft if BR-20 conflict is thrown', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: REV_ID_1 });
      await assert.rejects(
        () => service.deleteExhibitDraft(EXHIBIT_ID_1),
        ConflictException,
      );
      assert.equal(mockExhibits.deletedCascadeExhibitIds.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 9: ADMIN CMS — deleteDraftRevision (10 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 9: Admin CMS — deleteDraftRevision (10 Test Cases)', () => {
    it('TC-S101: deleteDraftRevision throws NotFoundException when exhibit does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = null;
      await assert.rejects(
        () => service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_1),
        NotFoundException,
      );
    });

    it('TC-S102: deleteDraftRevision throws NotFoundException when revision does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      mockExhibits.findRevisionByIdResult = null;
      await assert.rejects(
        () => service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_1),
        NotFoundException,
      );
    });

    it('TC-S103: deleteDraftRevision throws NotFoundException when revision belongs to different exhibit', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ id: EXHIBIT_ID_1 });
      mockExhibits.findRevisionByIdResult = createSampleRevision({ exhibitId: 'different-exhibit-id' });
      await assert.rejects(
        () => service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_1),
        NotFoundException,
      );
    });

    it('TC-S104: deleteDraftRevision throws ConflictException when revision is currently published', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: REV_ID_1 });
      mockExhibits.findRevisionByIdResult = createSampleRevision({ id: REV_ID_1, exhibitId: EXHIBIT_ID_1 });
      await assert.rejects(
        () => service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_1),
        (err: Error) => err instanceof ConflictException && err.message.includes('đang được xuất bản'),
      );
    });

    it('TC-S105: deleteDraftRevision throws ConflictException when revision state is APPROVED', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: 'other-id' });
      mockExhibits.findRevisionByIdResult = createSampleRevision({
        id: REV_ID_1,
        exhibitId: EXHIBIT_ID_1,
        state: RevisionState.APPROVED,
      });
      await assert.rejects(
        () => service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_1),
        (err: Error) => err instanceof ConflictException && err.message.includes('đã được phê duyệt'),
      );
    });

    it('TC-S106: deleteDraftRevision throws ConflictException when revision state is IN_REVIEW', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: 'other-id' });
      mockExhibits.findRevisionByIdResult = createSampleRevision({
        id: REV_ID_1,
        exhibitId: EXHIBIT_ID_1,
        state: RevisionState.IN_REVIEW,
      });
      await assert.rejects(
        () => service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_1),
        (err: Error) => err instanceof ConflictException && err.message.includes('đang chờ kiểm duyệt'),
      );
    });

    it('TC-S107: deleteDraftRevision deletes hotspots belonging to the target revision', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: 'other-id' });
      mockExhibits.findRevisionByIdResult = createSampleRevision({
        id: REV_ID_2,
        exhibitId: EXHIBIT_ID_1,
        state: RevisionState.DRAFT,
      });
      await service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_2);
      assert.deepEqual(mockExhibits.deletedHotspotRevisionIds, [[REV_ID_2]]);
    });

    it('TC-S108: deleteDraftRevision deletes the revision record by ID in transaction', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: 'other-id' });
      mockExhibits.findRevisionByIdResult = createSampleRevision({
        id: REV_ID_2,
        exhibitId: EXHIBIT_ID_1,
        state: RevisionState.DRAFT,
      });
      await service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_2);
      assert.deepEqual(mockExhibits.deletedRevisionIds, [REV_ID_2]);
    });

    it('TC-S109: deleteDraftRevision allows deleting a REJECTED revision', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: 'other-id' });
      mockExhibits.findRevisionByIdResult = createSampleRevision({
        id: REV_ID_2,
        exhibitId: EXHIBIT_ID_1,
        state: RevisionState.REJECTED,
      });
      const res = await service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_2);
      assert.equal(res.success, true);
    });

    it('TC-S110: deleteDraftRevision allows deleting a DRAFT revision and returns success', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit({ publishedRevisionId: 'other-id' });
      mockExhibits.findRevisionByIdResult = createSampleRevision({
        id: REV_ID_2,
        exhibitId: EXHIBIT_ID_1,
        state: RevisionState.DRAFT,
      });
      const res = await service.deleteDraftRevision(EXHIBIT_ID_1, REV_ID_2);
      assert.equal(res.success, true);
      assert.ok(res.message.includes('thành công'));
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 10: ADMIN CMS — reorderExhibits, History & Detail (15 Tests)
  // --------------------------------------------------------------------------
  describe('Suite 10: Admin CMS — reorderExhibits, History & Detail (15 Test Cases)', () => {
    it('TC-S111: reorderExhibits throws NotFoundException when target room does not exist', async () => {
      setup();
      mockRooms.roomById = null;
      await assert.rejects(
        () => service.reorderExhibits('non-existent-room', ['ex1', 'ex2']),
        NotFoundException,
      );
    });

    it('TC-S112: reorderExhibits throws NotFoundException when target room is soft-deleted', async () => {
      setup();
      mockRooms.roomById = createSampleRoom({ isDeleted: true });
      await assert.rejects(
        () => service.reorderExhibits(ROOM_ID_1, ['ex1', 'ex2']),
        NotFoundException,
      );
    });

    it('TC-S113: reorderExhibits updates displayOrder (1-indexed) for each exhibit ID in transaction', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      mockExhibits.roomExhibitIds = ['ex-C', 'ex-A', 'ex-B'];
      await service.reorderExhibits(ROOM_ID_1, ['ex-A', 'ex-B', 'ex-C']);
      assert.equal(mockExhibits.updatedDisplayOrders.length, 3);
      assert.deepEqual(mockExhibits.updatedDisplayOrders[0], { id: 'ex-A', roomId: ROOM_ID_1, displayOrder: 1 });
      assert.deepEqual(mockExhibits.updatedDisplayOrders[1], { id: 'ex-B', roomId: ROOM_ID_1, displayOrder: 2 });
      assert.deepEqual(mockExhibits.updatedDisplayOrders[2], { id: 'ex-C', roomId: ROOM_ID_1, displayOrder: 3 });
      assert.deepEqual(mockExhibits.lockedRoomIds, [ROOM_ID_1]);
      assert.equal(mockTx.calls, 1);
    });

    it('TC-S114: reorderExhibits returns success response message', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      mockExhibits.roomExhibitIds = ['ex-1'];
      const res = await service.reorderExhibits(ROOM_ID_1, ['ex-1']);
      assert.equal(res.success, true);
      assert.ok(res.message.includes('thành công'));
    });

    it('TC-S115: getRevisionsHistory throws NotFoundException when exhibit does not exist', async () => {
      setup();
      mockExhibits.findAdminDetailResult = null;
      await assert.rejects(
        () => service.getRevisionsHistory('non-existent-exhibit'),
        NotFoundException,
      );
    });

    it('TC-S116: getRevisionsHistory returns revisions list from repository', async () => {
      setup();
      mockExhibits.findAdminDetailResult = createSampleExhibit();
      const r1 = createSampleRevision({ revisionNo: 2 });
      const r2 = createSampleRevision({ revisionNo: 1 });
      mockExhibits.findRevisionsResult = [r1, r2];
      const res = await service.getRevisionsHistory(EXHIBIT_ID_1);
      assert.equal(res.length, 2);
      assert.equal(res[0].revisionNo, 2);
    });

    it('TC-S117: getRevisionDetail throws NotFoundException when revision does not exist', async () => {
      setup();
      mockExhibits.findRevisionByIdResult = null;
      await assert.rejects(
        () => service.getRevisionDetail(EXHIBIT_ID_1, 'non-existent-rev'),
        NotFoundException,
      );
    });

    it('TC-S118: getRevisionDetail throws NotFoundException when revision belongs to different exhibit', async () => {
      setup();
      mockExhibits.findRevisionByIdResult = createSampleRevision({ exhibitId: 'other-exhibit-id' });
      await assert.rejects(
        () => service.getRevisionDetail(EXHIBIT_ID_1, REV_ID_1),
        NotFoundException,
      );
    });

    it('TC-S119: getRevisionDetail returns revision entity when valid', async () => {
      setup();
      const rev = createSampleRevision({ id: REV_ID_1, exhibitId: EXHIBIT_ID_1 });
      mockExhibits.findRevisionByIdResult = rev;
      const res = await service.getRevisionDetail(EXHIBIT_ID_1, REV_ID_1);
      assert.equal(res.id, REV_ID_1);
      assert.equal(res.exhibitId, EXHIBIT_ID_1);
    });

    it('TC-S120: reorderExhibits accepts an empty list only for a room without exhibits', async () => {
      setup();
      mockRooms.roomById = createSampleRoom();
      const res = await service.reorderExhibits(ROOM_ID_1, []);
      assert.equal(res.success, true);
      assert.equal(mockExhibits.updatedDisplayOrders.length, 0);
    });

    /** Gọi reorder với danh sách sai, kỳ vọng 422 `reorder_ids_mismatch` và không ghi gì. */
    async function assertReorderRejected(roomExhibitIds: string[], exhibitIds: string[]) {
      setup();
      mockRooms.roomById = createSampleRoom();
      mockExhibits.roomExhibitIds = roomExhibitIds;
      await assert.rejects(
        () => service.reorderExhibits(ROOM_ID_1, exhibitIds),
        (error: unknown) => {
          assert.ok(error instanceof DomainValidationException);
          const body = error.getResponse() as { errors: { field: string; code: string }[] };
          assert.deepEqual(body.errors.map((e) => [e.field, e.code]), [['exhibitIds', 'reorder_ids_mismatch']]);
          return true;
        },
      );
      assert.equal(mockExhibits.updatedDisplayOrders.length, 0);
    }

    it('TC-S121: reorderExhibits rejects an exhibit that belongs to another room', async () => {
      await assertReorderRejected(['ex-A', 'ex-B'], ['ex-A', 'ex-other-room']);
    });

    it('TC-S122: reorderExhibits rejects a list that also contains another room exhibit', async () => {
      await assertReorderRejected(['ex-A', 'ex-B'], ['ex-A', 'ex-B', 'ex-other-room']);
    });

    it('TC-S123: reorderExhibits rejects a list missing an exhibit of the room', async () => {
      await assertReorderRejected(['ex-A', 'ex-B', 'ex-C'], ['ex-A', 'ex-B']);
    });

    it('TC-S124: reorderExhibits rejects duplicate exhibit IDs', async () => {
      await assertReorderRejected(['ex-A', 'ex-B'], ['ex-A', 'ex-A']);
    });

    it('TC-S125: reorderExhibits rejects unknown IDs instead of silently ignoring them', async () => {
      await assertReorderRejected([], ['ex-ghost']);
    });
  });
});
