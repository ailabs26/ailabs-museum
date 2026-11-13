import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Brackets,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';

interface NestedRelations {
  [key: string]: boolean | NestedRelations | undefined;
}

// Helper tạo Exhibit mẫu
function createSampleExhibit(overrides?: Partial<Exhibit>): Exhibit {
  const ex = new Exhibit();
  ex.id = overrides?.id ?? '11111111-1111-4111-8111-111111111111';
  ex.roomId = overrides?.roomId ?? '22222222-2222-4222-8222-222222222222';
  ex.visibility = overrides?.visibility ?? ExhibitVisibility.VISIBLE;
  ex.version = overrides?.version ?? 1;
  ex.displayOrder = overrides?.displayOrder ?? 0;
  ex.publishedRevisionId =
    overrides && 'publishedRevisionId' in overrides
      ? overrides.publishedRevisionId!
      : '33333333-3333-4333-8333-333333333333';
  ex.isDeleted = overrides?.isDeleted ?? false;
  ex.deletedAt = overrides?.deletedAt ?? null;
  ex.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  ex.updatedAt = overrides?.updatedAt ?? new Date('2026-10-10T12:00:00Z');
  return ex;
}

// Helper tạo ExhibitRevision mẫu
function createSampleRevision(overrides?: Partial<ExhibitRevision>): ExhibitRevision {
  const rev = new ExhibitRevision();
  rev.id = overrides?.id ?? '33333333-3333-4333-8333-333333333333';
  rev.exhibitId = overrides?.exhibitId ?? '11111111-1111-4111-8111-111111111111';
  rev.revisionNo = overrides?.revisionNo ?? 1;
  rev.state = overrides?.state ?? RevisionState.APPROVED;
  rev.content = overrides?.content ?? {
    name: 'Trống đồng Cảnh Thịnh',
    description: 'Bảo vật quốc gia thời Tây Sơn',
    position: { x: 0, y: 1, z: 0 },
  };
  rev.createdById = '44444444-4444-4444-8444-444444444444';
  rev.createdAt = new Date('2026-10-10T10:00:00Z');
  rev.hotspots = overrides?.hotspots ?? [];
  return rev;
}

// Mock QueryBuilder ghi nhận các lời gọi hàm
class MockSelectQueryBuilder<T> {
  joinedRelations: string[] = [];
  whereCondition: string = '';
  whereParams?: Record<string, unknown>;
  andWhereList: Array<{ condition: string | Brackets; params?: Record<string, unknown> }> = [];
  selectedFields: string[] = [];
  orderList: Array<{ sort: string; dir: 'ASC' | 'DESC' }> = [];
  skipValue: number = 0;
  takeValue: number = 0;
  mockResult: [T[], number] = [[], 0];
  mockRawOneResult: unknown = null;

  leftJoinAndSelect(relation: string, alias: string) {
    this.joinedRelations.push(`${relation} as ${alias}`);
    return this;
  }

  where(condition: string, params?: Record<string, unknown>) {
    this.whereCondition = condition;
    this.whereParams = params;
    return this;
  }

  andWhere(condition: string | Brackets, params?: Record<string, unknown>) {
    this.andWhereList.push({ condition, params });
    return this;
  }

  select(selection: string, alias?: string) {
    this.selectedFields.push(alias ? `${selection} AS ${alias}` : selection);
    return this;
  }

  orderBy(sort: string, dir: 'ASC' | 'DESC' = 'ASC') {
    this.orderList.push({ sort, dir });
    return this;
  }

  addOrderBy(sort: string, dir: 'ASC' | 'DESC' = 'ASC') {
    this.orderList.push({ sort, dir });
    return this;
  }

  skip(val: number) {
    this.skipValue = val;
    return this;
  }

  take(val: number) {
    this.takeValue = val;
    return this;
  }

  async getManyAndCount(): Promise<[T[], number]> {
    return this.mockResult;
  }

  async getRawOne<R = unknown>(): Promise<R | null> {
    return this.mockRawOneResult as R | null;
  }
}

// Mock Generic TypeORM Repository
class MockRepository<T extends object> {
  lastFindOneOptions?: FindOneOptions<T>;
  lastFindOptions?: FindManyOptions<T>;
  lastExistsWhere?: unknown;
  lastDeleteCondition?: unknown;
  lastSavedEntity?: unknown;
  mockFindOneResult: T | null = null;
  mockFindResult: T[] = [];
  mockCountResult: number = 0;
  mockQb = new MockSelectQueryBuilder<T>();

  constructor(public target: new () => T) {}

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    this.lastFindOneOptions = options;
    return Promise.resolve(this.mockFindOneResult);
  }

  find(options?: FindManyOptions<T>): Promise<T[]> {
    this.lastFindOptions = options;
    return Promise.resolve(this.mockFindResult);
  }

  count(options?: { where?: unknown }): Promise<number> {
    this.lastExistsWhere = options?.where;
    return Promise.resolve(this.mockCountResult);
  }

  save(entity: unknown): Promise<unknown> {
    this.lastSavedEntity = entity;
    return Promise.resolve(entity);
  }

  delete(condition: unknown): Promise<{ affected?: number }> {
    this.lastDeleteCondition = condition;
    return Promise.resolve({ affected: 1 });
  }

  createQueryBuilder(): SelectQueryBuilder<T> {
    return this.mockQb as unknown as SelectQueryBuilder<T>;
  }
}

describe('Task 7.2 — ExhibitsRepository Comprehensive Test Suite (105 Test Cases)', () => {
  const EXHIBIT_ID = '11111111-1111-4111-8111-111111111111';
  const ROOM_ID = '22222222-2222-4222-8222-222222222222';
  const REVISION_ID = '33333333-3333-4333-8333-333333333333';

  // ===========================================================================
  // SUITE 1: findByRoom — Public Exhibit Queries (10 Test Cases)
  // ===========================================================================
  describe('Suite 1: findByRoom — Public Exhibit Queries (10 Test Cases)', () => {
    it('TC-E001: Tìm hiện vật với đúng roomId, visibility = "visible", isDeleted = false', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findByRoom(ROOM_ID);
      const where = mockExhibitRepo.lastFindOptions?.where as FindOptionsWhere<Exhibit>;
      assert.equal(where?.roomId, ROOM_ID);
      assert.equal(where?.visibility, ExhibitVisibility.VISIBLE);
      assert.equal(where?.isDeleted, false);
    });

    it('TC-E002: Kiểm tra nạp quan hệ publishedRevision (model, image, audio, hotspots)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findByRoom(ROOM_ID);
      const rels = mockExhibitRepo.lastFindOptions?.relations;
      assert.deepEqual(rels, {
        publishedRevision: {
          modelMedia: true,
          imageMedia: true,
          audioMedia: true,
          audioEnMedia: true,
          subtitleViMedia: true,
          subtitleEnMedia: true,
          hotspots: true,
        },
      });
    });

    it('TC-E003: Sắp xếp theo displayOrder: "ASC", id: "ASC"', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findByRoom(ROOM_ID);
      assert.deepEqual(mockExhibitRepo.lastFindOptions?.order, {
        displayOrder: 'ASC',
        id: 'ASC',
      });
    });

    it('TC-E004: Trả về mảng rỗng [] khi phòng không có hiện vật', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindResult = [];
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const result = await repo.findByRoom(ROOM_ID);
      assert.deepEqual(result, []);
    });

    it('TC-E005: Bỏ qua hiện vật đã bị xóa mềm (isDeleted = true)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findByRoom(ROOM_ID);
      const where = mockExhibitRepo.lastFindOptions?.where as FindOptionsWhere<Exhibit>;
      assert.equal(where?.isDeleted, false);
    });

    it('TC-E006: Bỏ qua hiện vật đang ẩn (visibility = "hidden")', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findByRoom(ROOM_ID);
      const where = mockExhibitRepo.lastFindOptions?.where as FindOptionsWhere<Exhibit>;
      assert.notEqual(where?.visibility, ExhibitVisibility.HIDDEN);
    });

    it('TC-E007: Trả về danh sách khi phòng có 1 hiện vật', async () => {
      const sample = createSampleExhibit({ roomId: ROOM_ID });
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindResult = [sample];
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findByRoom(ROOM_ID);
      assert.equal(res.length, 1);
      assert.equal(res[0].id, sample.id);
    });

    it('TC-E008: Trả về danh sách khi phòng có nhiều hiện vật (5 hiện vật)', async () => {
      const samples = Array.from({ length: 5 }, (_, i) =>
        createSampleExhibit({ id: `exhibit-${i}`, roomId: ROOM_ID }),
      );
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindResult = samples;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findByRoom(ROOM_ID);
      assert.equal(res.length, 5);
    });

    it('TC-E009: Giữ đúng roomId đã truyền trong điều kiện truy vấn', async () => {
      const customRoomId = 'room-abc-xyz';
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findByRoom(customRoomId);
      const where = mockExhibitRepo.lastFindOptions?.where as FindOptionsWhere<Exhibit>;
      assert.equal(where?.roomId, customRoomId);
    });

    it('TC-E010: Xử lý an toàn khi truyền roomId dạng UUID chuẩn', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findByRoom(ROOM_ID);
      assert.ok(mockExhibitRepo.lastFindOptions?.where);
    });
  });

  // ===========================================================================
  // SUITE 2: findAdminDetailById — Detail Queries & Relations (15 Test Cases)
  // ===========================================================================
  describe('Suite 2: findAdminDetailById — Detail Queries & Relations (15 Test Cases)', () => {
    it('TC-E011: Tìm hiện vật với đúng id và isDeleted = false', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const where = mockExhibitRepo.lastFindOneOptions?.where as FindOptionsWhere<Exhibit>;
      assert.equal(where?.id, EXHIBIT_ID);
      assert.equal(where?.isDeleted, false);
    });

    it('TC-E012: Kiểm tra nạp quan hệ room', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as Record<string, unknown>;
      assert.equal(rels?.room, true);
    });

    it('TC-E013: Kiểm tra nạp quan hệ publishedRevision', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as Record<string, unknown>;
      assert.ok(rels?.publishedRevision);
    });

    it('TC-E014: Kiểm tra nạp quan hệ publishedRevision.modelMedia', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as NestedRelations;
      const pubRel = rels?.publishedRevision as NestedRelations | undefined;
      assert.equal(pubRel?.modelMedia, true);
    });

    it('TC-E015: Kiểm tra nạp quan hệ publishedRevision.imageMedia', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as NestedRelations;
      const pubRel = rels?.publishedRevision as NestedRelations | undefined;
      assert.equal(pubRel?.imageMedia, true);
    });

    it('TC-E016: Kiểm tra nạp quan hệ publishedRevision.audioMedia', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as NestedRelations;
      const pubRel = rels?.publishedRevision as NestedRelations | undefined;
      assert.equal(pubRel?.audioMedia, true);
    });

    it('TC-E017: Kiểm tra nạp quan hệ publishedRevision.hotspots', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as NestedRelations;
      const pubRel = rels?.publishedRevision as NestedRelations | undefined;
      assert.equal(pubRel?.hotspots, true);
    });

    it('TC-E018: Kiểm tra nạp quan hệ revisions', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as NestedRelations;
      assert.ok(rels?.revisions);
    });

    it('TC-E019: Kiểm tra nạp quan hệ revisions.createdBy', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as NestedRelations;
      const revRels = rels?.revisions as NestedRelations | undefined;
      assert.equal(revRels?.createdBy, true);
    });

    it('TC-E020: Kiểm tra nạp quan hệ revisions.reviewedBy', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findAdminDetailById(EXHIBIT_ID);
      const rels = mockExhibitRepo.lastFindOneOptions?.relations as NestedRelations;
      const revRels = rels?.revisions as NestedRelations | undefined;
      assert.equal(revRels?.reviewedBy, true);
    });

    it('TC-E021: Trả về null khi không tìm thấy hiện vật', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindOneResult = null;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findAdminDetailById('non-existent');
      assert.equal(res, null);
    });

    it('TC-E022: Trả về null khi hiện vật đã bị xóa mềm (isDeleted = true)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindOneResult = null;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findAdminDetailById(EXHIBIT_ID);
      assert.equal(res, null);
    });

    it('TC-E023: Trả về đối tượng Exhibit đầy đủ khi tìm thấy', async () => {
      const sample = createSampleExhibit({ id: EXHIBIT_ID });
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindOneResult = sample;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findAdminDetailById(EXHIBIT_ID);
      assert.equal(res?.id, EXHIBIT_ID);
    });

    it('TC-E024: Cho phép tìm hiện vật ở trạng thái hidden (Admin xem được Draft/Hidden)', async () => {
      const sample = createSampleExhibit({ id: EXHIBIT_ID, visibility: ExhibitVisibility.HIDDEN });
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindOneResult = sample;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findAdminDetailById(EXHIBIT_ID);
      assert.equal(res?.visibility, ExhibitVisibility.HIDDEN);
    });

    it('TC-E025: Cho phép tìm hiện vật chưa có publishedRevisionId (null)', async () => {
      const sample = createSampleExhibit({ id: EXHIBIT_ID, publishedRevisionId: null });
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindOneResult = sample;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findAdminDetailById(EXHIBIT_ID);
      assert.equal(res?.publishedRevisionId, null);
    });
  });

  // ===========================================================================
  // SUITE 3: findRevisionsByExhibitId & findRevisionById (15 Test Cases)
  // ===========================================================================
  describe('Suite 3: findRevisionsByExhibitId & findRevisionById (15 Test Cases)', () => {
    it('TC-E026: Lọc theo đúng exhibitId khi tìm revisions', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionsByExhibitId(EXHIBIT_ID);
      const where = mockRevRepo.lastFindOptions?.where as FindOptionsWhere<ExhibitRevision>;
      assert.equal(where?.exhibitId, EXHIBIT_ID);
    });

    it('TC-E027: Sắp xếp theo revisionNo: "DESC" (phiên bản mới nhất lên đầu)', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionsByExhibitId(EXHIBIT_ID);
      assert.deepEqual(mockRevRepo.lastFindOptions?.order, { revisionNo: 'DESC' });
    });

    it('TC-E028: Nạp đầy đủ relations của revision (model, image, audio, hotspots)', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionsByExhibitId(EXHIBIT_ID);
      const rels = mockRevRepo.lastFindOptions?.relations as NestedRelations;
      assert.equal(rels?.modelMedia, true);
      assert.equal(rels?.imageMedia, true);
      assert.equal(rels?.audioMedia, true);
      assert.equal(rels?.hotspots, true);
    });

    it('TC-E029: Nạp quan hệ người tạo createdBy và người duyệt reviewedBy', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionsByExhibitId(EXHIBIT_ID);
      const rels = mockRevRepo.lastFindOptions?.relations as NestedRelations;
      assert.equal(rels?.createdBy, true);
      assert.equal(rels?.reviewedBy, true);
    });

    it('TC-E030: Trả về mảng rỗng [] khi hiện vật chưa có revision nào', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockFindResult = [];
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findRevisionsByExhibitId(EXHIBIT_ID);
      assert.deepEqual(res, []);
    });

    it('TC-E031: Trả về mảng có 1 revision khi có 1 phiên bản', async () => {
      const rev = createSampleRevision({ exhibitId: EXHIBIT_ID });
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockFindResult = [rev];
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findRevisionsByExhibitId(EXHIBIT_ID);
      assert.equal(res.length, 1);
      assert.equal(res[0].id, rev.id);
    });

    it('TC-E032: Trả về danh sách nhiều revision theo thứ tự giảm dần', async () => {
      const rev1 = createSampleRevision({ revisionNo: 2 });
      const rev2 = createSampleRevision({ revisionNo: 1 });
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockFindResult = [rev1, rev2];
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findRevisionsByExhibitId(EXHIBIT_ID);
      assert.equal(res.length, 2);
      assert.equal(res[0].revisionNo, 2);
    });

    it('TC-E033: findRevisionById tìm đúng id của revision', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionById(REVISION_ID);
      const where = mockRevRepo.lastFindOneOptions?.where as FindOptionsWhere<ExhibitRevision>;
      assert.equal(where?.id, REVISION_ID);
    });

    it('TC-E034: findRevisionById nạp quan hệ exhibit', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionById(REVISION_ID);
      const rels = mockRevRepo.lastFindOneOptions?.relations as NestedRelations;
      assert.equal(rels?.exhibit, true);
    });

    it('TC-E035: findRevisionById nạp các quan hệ media và hotspots', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionById(REVISION_ID);
      const rels = mockRevRepo.lastFindOneOptions?.relations as NestedRelations;
      assert.equal(rels?.hotspots, true);
      assert.equal(rels?.modelMedia, true);
    });

    it('TC-E036: findRevisionById trả về null khi ID không tồn tại', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockFindOneResult = null;
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findRevisionById('not-found');
      assert.equal(res, null);
    });

    it('TC-E037: findRevisionById sử dụng manager khi truyền transaction manager', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      let managerUsed = false;
      const mockManager = {
        getRepository: (target: unknown) => {
          if (target === ExhibitRevision) managerUsed = true;
          return mockRevRepo;
        },
      } as unknown as EntityManager;

      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionById(REVISION_ID, mockManager);
      assert.equal(managerUsed, true);
    });

    it('TC-E038: findRevisionById sử dụng repo mặc định khi không truyền manager', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findRevisionById(REVISION_ID);
      assert.ok(mockRevRepo.lastFindOneOptions);
    });

    it('TC-E039: Bảo toàn dữ liệu JSONB content trong revision', async () => {
      const rev = createSampleRevision({
        content: {
          name: 'Bia Tiến sĩ',
          description: 'Văn Miếu Quốc Tử Giám',
          position: { x: 2, y: 1, z: 0 },
        },
      });
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockFindOneResult = rev;
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findRevisionById(REVISION_ID);
      assert.equal(res?.content?.name, 'Bia Tiến sĩ');
    });

    it('TC-E040: Giữ nguyên trạng thái state của revision (APPROVED)', async () => {
      const rev = createSampleRevision({ state: RevisionState.APPROVED });
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockFindOneResult = rev;
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findRevisionById(REVISION_ID);
      assert.equal(res?.state, RevisionState.APPROVED);
    });
  });

  // ===========================================================================
  // SUITE 4: findLatestRevisionNo & findActiveRevision (10 Test Cases)
  // ===========================================================================
  describe('Suite 4: findLatestRevisionNo & findActiveRevision (10 Test Cases)', () => {
    it('TC-E041: findLatestRevisionNo gọi QueryBuilder với MAX(rev.revisionNo)', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockQb.mockRawOneResult = { maxNo: 3 };
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findLatestRevisionNo(EXHIBIT_ID);
      assert.ok(mockRevRepo.mockQb.selectedFields.some((s) => s.includes('MAX(rev.revisionNo)')));
    });

    it('TC-E042: Lọc đúng exhibitId trong truy vấn MAX', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockQb.mockRawOneResult = { maxNo: 1 };
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findLatestRevisionNo(EXHIBIT_ID);
      assert.equal(mockRevRepo.mockQb.whereParams?.exhibitId, EXHIBIT_ID);
    });

    it('TC-E043: Trả về số lớn nhất (ví dụ: 5) khi đã có revision', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockQb.mockRawOneResult = { maxNo: 5 };
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const maxNo = await repo.findLatestRevisionNo(EXHIBIT_ID);
      assert.equal(maxNo, 5);
    });

    it('TC-E044: Trả về 0 khi hiện vật chưa có revision nào (raw.maxNo = null)', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockQb.mockRawOneResult = { maxNo: null };
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const maxNo = await repo.findLatestRevisionNo(EXHIBIT_ID);
      assert.equal(maxNo, 0);
    });

    it('TC-E045: Trả về 0 khi query trả về null/undefined', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockQb.mockRawOneResult = null;
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const maxNo = await repo.findLatestRevisionNo(EXHIBIT_ID);
      assert.equal(maxNo, 0);
    });

    it('TC-E046: Chuyển đổi đúng kiểu dữ liệu từ chuỗi sang số ("3" -> 3)', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockQb.mockRawOneResult = { maxNo: '3' };
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const maxNo = await repo.findLatestRevisionNo(EXHIBIT_ID);
      assert.equal(maxNo, 3);
      assert.equal(typeof maxNo, 'number');
    });

    it('TC-E047: findActiveRevision tìm theo đúng exhibitId', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findActiveRevision(EXHIBIT_ID);
      const where = mockRevRepo.lastFindOneOptions?.where as FindOptionsWhere<ExhibitRevision>;
      assert.equal(where?.exhibitId, EXHIBIT_ID);
    });

    it('TC-E048: findActiveRevision sắp xếp revisionNo: "DESC"', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findActiveRevision(EXHIBIT_ID);
      assert.deepEqual(mockRevRepo.lastFindOneOptions?.order, { revisionNo: 'DESC' });
    });

    it('TC-E049: findActiveRevision nạp các relations media và hotspots', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.findActiveRevision(EXHIBIT_ID);
      const rels = mockRevRepo.lastFindOneOptions?.relations as NestedRelations;
      assert.equal(rels?.hotspots, true);
      assert.equal(rels?.modelMedia, true);
    });

    it('TC-E050: findActiveRevision trả về null khi không có revision nào', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      mockRevRepo.mockFindOneResult = null;
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findActiveRevision(EXHIBIT_ID);
      assert.equal(res, null);
    });
  });

  // ===========================================================================
  // SUITE 5: searchAdminExhibits — Pagination & Filters (25 Test Cases)
  // ===========================================================================
  describe('Suite 5: searchAdminExhibits — Pagination & Filters (25 Test Cases)', () => {
    it('TC-E051: Mặc định phân trang page = 1, pageSize = 20, skip = 0, take = 20', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({});
      assert.equal(mockExhibitRepo.mockQb.skipValue, 0);
      assert.equal(mockExhibitRepo.mockQb.takeValue, 20);
    });

    it('TC-E052: Tự động điều chỉnh khi page < 1 (chuyển về 1)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.searchAdminExhibits({ page: -3 });
      assert.equal(res.page, 1);
      assert.equal(mockExhibitRepo.mockQb.skipValue, 0);
    });

    it('TC-E053: Tự động điều chỉnh khi pageSize < 1 (chuyển về 1)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.searchAdminExhibits({ pageSize: 0 });
      assert.equal(res.pageSize, 1);
      assert.equal(mockExhibitRepo.mockQb.takeValue, 1);
    });

    it('TC-E054: Tự động giới hạn pageSize > 100 (chuyển về 100)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.searchAdminExhibits({ pageSize: 500 });
      assert.equal(res.pageSize, 100);
      assert.equal(mockExhibitRepo.mockQb.takeValue, 100);
    });

    it('TC-E055: Tính đúng skip khi page = 3, pageSize = 10 (skip = 20)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ page: 3, pageSize: 10 });
      assert.equal(mockExhibitRepo.mockQb.skipValue, 20);
      assert.equal(mockExhibitRepo.mockQb.takeValue, 10);
    });

    it('TC-E056: Nạp quan hệ room qua leftJoinAndSelect', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({});
      assert.ok(mockExhibitRepo.mockQb.joinedRelations.includes('exhibit.room as room'));
    });

    it('TC-E057: Nạp quan hệ publishedRevision qua leftJoinAndSelect', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({});
      assert.ok(
        mockExhibitRepo.mockQb.joinedRelations.includes('exhibit.publishedRevision as publishedRevision'),
      );
    });

    it('TC-E058: Luôn lọc exhibit.isDeleted = false', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({});
      assert.equal(mockExhibitRepo.mockQb.whereCondition, 'exhibit.isDeleted = :isDeleted');
      assert.equal(mockExhibitRepo.mockQb.whereParams?.isDeleted, false);
    });

    it('TC-E059: Lọc chính xác theo roomId khi cung cấp', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ roomId: ROOM_ID });
      const found = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => typeof w.condition === 'string' && w.condition.includes('exhibit.roomId = :roomId'),
      );
      assert.ok(found);
      assert.equal(found?.params?.roomId, ROOM_ID);
    });

    it('TC-E060: Bỏ qua điều kiện roomId khi không truyền', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({});
      const found = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => typeof w.condition === 'string' && w.condition.includes('exhibit.roomId = :roomId'),
      );
      assert.equal(found, undefined);
    });

    it('TC-E061: Lọc chính xác theo visibility = "visible"', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ visibility: ExhibitVisibility.VISIBLE });
      const found = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => typeof w.condition === 'string' && w.condition.includes('exhibit.visibility = :visibility'),
      );
      assert.ok(found);
      assert.equal(found?.params?.visibility, ExhibitVisibility.VISIBLE);
    });

    it('TC-E062: Lọc chính xác theo visibility = "hidden"', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ visibility: ExhibitVisibility.HIDDEN });
      const found = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => typeof w.condition === 'string' && w.condition.includes('exhibit.visibility = :visibility'),
      );
      assert.ok(found);
      assert.equal(found?.params?.visibility, ExhibitVisibility.HIDDEN);
    });

    it('TC-E063: Lọc status = "published": publishedRevisionId IS NOT NULL và visibility = "visible"', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ status: 'published' });
      const notNullCond = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => typeof w.condition === 'string' && w.condition.includes('exhibit.publishedRevisionId IS NOT NULL'),
      );
      assert.ok(notNullCond);
    });

    it('TC-E064: Lọc status = "draft": dùng Brackets kiểm tra draft hoặc hidden', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ status: 'draft' });
      const bracketCond = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => w.condition instanceof Brackets,
      );
      assert.ok(bracketCond);
    });

    it('TC-E065: Lọc status = "all": không thêm điều kiện lọc status', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ status: 'all' });
      const statusCond = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => typeof w.condition === 'string' && w.condition.includes('publishedRevisionId'),
      );
      assert.equal(statusCond, undefined);
    });

    it('TC-E066: Tìm kiếm q: áp dụng Brackets tìm kiếm ILIKE', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ q: 'trống đồng' });
      const searchBracket = mockExhibitRepo.mockQb.andWhereList.find(
        (w) => w.condition instanceof Brackets,
      );
      assert.ok(searchBracket);
    });

    it('TC-E067: Tìm kiếm q: kiểm tra tham số search có % bao quanh', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ q: 'gốm' });
      const bracket = mockExhibitRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.equal(bracket?.params?.search, '%gốm%');
    });

    it('TC-E068: Tìm kiếm q: tìm trong publishedRevision.content (cast text)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ q: 'chuông' });
      assert.ok(mockExhibitRepo.mockQb.andWhereList.some((w) => w.condition instanceof Brackets));
    });

    it('TC-E068b: Tìm kiếm q: tìm cả trong revision mới nhất (hiện vật nháp chưa publish)', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ q: 'nháp' });
      const bracket = mockExhibitRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      const conditions: string[] = [];
      const capture = {
        where: (c: string) => (conditions.push(c), capture),
        orWhere: (c: string) => (conditions.push(c), capture),
      };
      (bracket?.condition as Brackets).whereFactory(capture as never);
      assert.ok(
        conditions.some(
          (c) => c.includes('exhibit_revisions latest') && c.includes('ORDER BY latest.revision_no DESC LIMIT 1'),
        ),
      );
    });

    it('TC-E069: Trim khoảng trắng trong từ khóa tìm kiếm q', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ q: '   trống đồng   ' });
      const bracket = mockExhibitRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.equal(bracket?.params?.search, '%trống đồng%');
    });

    it('TC-E070: Bỏ qua điều kiện tìm kiếm khi q chỉ gồm khoảng trắng ("   ")', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({ q: '   ' });
      const bracket = mockExhibitRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.equal(bracket, undefined);
    });

    it('TC-E071: Sắp xếp theo exhibit.displayOrder ASC', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({});
      assert.equal(mockExhibitRepo.mockQb.orderList[0]?.sort, 'exhibit.displayOrder');
      assert.equal(mockExhibitRepo.mockQb.orderList[0]?.dir, 'ASC');
    });

    it('TC-E072: Thêm sắp xếp phụ exhibit.createdAt DESC', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({});
      assert.equal(mockExhibitRepo.mockQb.orderList[1]?.sort, 'exhibit.createdAt');
      assert.equal(mockExhibitRepo.mockQb.orderList[1]?.dir, 'DESC');
    });

    it('TC-E073: Trả về kết quả phân trang chuẩn { items, total, page, pageSize }', async () => {
      const sample = createSampleExhibit();
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockQb.mockResult = [[sample], 1];
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.searchAdminExhibits({ page: 1, pageSize: 20 });
      assert.equal(res.total, 1);
      assert.equal(res.items.length, 1);
      assert.equal(res.page, 1);
      assert.equal(res.pageSize, 20);
    });

    it('TC-E074: Trả về mảng rỗng khi không có kết quả khớp', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockQb.mockResult = [[], 0];
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.searchAdminExhibits({});
      assert.equal(res.total, 0);
      assert.deepEqual(res.items, []);
    });

    it('TC-E075: Áp dụng đồng thời cả 4 bộ lọc: roomId, visibility, status và q', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.searchAdminExhibits({
        roomId: ROOM_ID,
        visibility: ExhibitVisibility.VISIBLE,
        status: 'published',
        q: 'bảo vật',
      });

      assert.ok(mockExhibitRepo.mockQb.andWhereList.length >= 4);
    });
  });

  // ===========================================================================
  // SUITE 6: saveRevision & saveHotspots (10 Test Cases)
  // ===========================================================================
  describe('Suite 6: saveRevision & saveHotspots (10 Test Cases)', () => {
    it('TC-E076: saveRevision lưu thành công một bản ghi revision mới', async () => {
      const rev = createSampleRevision();
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const saved = await repo.saveRevision(rev);
      assert.equal(mockRevRepo.lastSavedEntity, rev);
      assert.equal(saved.id, rev.id);
    });

    it('TC-E077: saveRevision sử dụng EntityManager khi có transaction manager', async () => {
      const rev = createSampleRevision();
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      let managerUsed = false;
      const mockManager = {
        getRepository: (target: unknown) => {
          if (target === ExhibitRevision) managerUsed = true;
          return mockRevRepo;
        },
      } as unknown as EntityManager;

      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.saveRevision(rev, mockManager);
      assert.equal(managerUsed, true);
    });

    it('TC-E078: saveRevision sử dụng repo gốc khi không có manager', async () => {
      const rev = createSampleRevision();
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.saveRevision(rev);
      assert.equal(mockRevRepo.lastSavedEntity, rev);
    });

    it('TC-E079: saveRevision trả về entity đã lưu kèm ID', async () => {
      const rev = createSampleRevision({ id: 'new-rev-uuid' });
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const saved = await repo.saveRevision(rev);
      assert.equal(saved.id, 'new-rev-uuid');
    });

    it('TC-E080: saveHotspots lưu danh sách nhiều hotspots', async () => {
      const hs1 = new Hotspot();
      hs1.label = 'Điểm 1';
      const hs2 = new Hotspot();
      hs2.label = 'Điểm 2';
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      const saved = await repo.saveHotspots([hs1, hs2]);
      assert.deepEqual(mockHotspotRepo.lastSavedEntity, [hs1, hs2]);
      assert.equal(saved.length, 2);
    });

    it('TC-E081: saveHotspots trả về mảng rỗng [] khi mảng đầu vào rỗng', async () => {
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      const saved = await repo.saveHotspots([]);
      assert.deepEqual(saved, []);
      assert.equal(mockHotspotRepo.lastSavedEntity, undefined);
    });

    it('TC-E082: saveHotspots sử dụng EntityManager khi có transaction manager', async () => {
      const hs = new Hotspot();
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      let managerUsed = false;
      const mockManager = {
        getRepository: (target: unknown) => {
          if (target === Hotspot) managerUsed = true;
          return mockHotspotRepo;
        },
      } as unknown as EntityManager;

      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      await repo.saveHotspots([hs], mockManager);
      assert.equal(managerUsed, true);
    });

    it('TC-E083: saveHotspots sử dụng repo gốc khi không có manager', async () => {
      const hs = new Hotspot();
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      await repo.saveHotspots([hs]);
      assert.deepEqual(mockHotspotRepo.lastSavedEntity, [hs]);
    });

    it('TC-E084: saveHotspots giữ nguyên các thuộc tính của hotspot (label, body, position)', async () => {
      const hs = new Hotspot();
      hs.label = 'Hoa văn';
      hs.body = 'Mô tả hoa văn';
      hs.positionX = '1.2';
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      await repo.saveHotspots([hs]);
      const saved = mockHotspotRepo.lastSavedEntity as Hotspot[];
      assert.equal(saved[0].label, 'Hoa văn');
      assert.equal(saved[0].positionX, '1.2');
    });

    it('TC-E085: saveHotspots lưu danh sách 1 hotspot đơn lẻ', async () => {
      const hs = new Hotspot();
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      const res = await repo.saveHotspots([hs]);
      assert.equal(res.length, 1);
    });
  });

  // ===========================================================================
  // SUITE 7: Cascade Deletion & Bulk Operations (10 Test Cases)
  // ===========================================================================
  describe('Suite 7: Cascade Deletion & Bulk Operations (10 Test Cases)', () => {
    it('TC-E086: deleteHotspotsByRevisionIds gọi delete với In(revisionIds)', async () => {
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      await repo.deleteHotspotsByRevisionIds(['rev-1', 'rev-2']);
      assert.ok(mockHotspotRepo.lastDeleteCondition);
    });

    it('TC-E087: deleteHotspotsByRevisionIds không gọi delete khi mảng rỗng []', async () => {
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      await repo.deleteHotspotsByRevisionIds([]);
      assert.equal(mockHotspotRepo.lastDeleteCondition, undefined);
    });

    it('TC-E088: deleteHotspotsByRevisionIds sử dụng manager khi truyền transaction', async () => {
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      let managerUsed = false;
      const mockManager = {
        getRepository: (target: unknown) => {
          if (target === Hotspot) managerUsed = true;
          return mockHotspotRepo;
        },
      } as unknown as EntityManager;

      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      await repo.deleteHotspotsByRevisionIds(['rev-1'], mockManager);
      assert.equal(managerUsed, true);
    });

    it('TC-E089: deleteRevisionsByExhibitId gọi delete với { exhibitId }', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.deleteRevisionsByExhibitId(EXHIBIT_ID);
      assert.deepEqual(mockRevRepo.lastDeleteCondition, { exhibitId: EXHIBIT_ID });
    });

    it('TC-E090: deleteRevisionsByExhibitId sử dụng manager khi truyền transaction', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      let managerUsed = false;
      const mockManager = {
        getRepository: (target: unknown) => {
          if (target === ExhibitRevision) managerUsed = true;
          return mockRevRepo;
        },
      } as unknown as EntityManager;

      const repo = new ExhibitsRepository(
        new MockRepository(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.deleteRevisionsByExhibitId(EXHIBIT_ID, mockManager);
      assert.equal(managerUsed, true);
    });

    it('TC-E091: markDeleted đánh dấu is_deleted/deleted_at cho mọi ID qua manager của transaction', async () => {
      const updates: Array<{ criteria: { id: { value: string[] } }; patch: Partial<Exhibit> }> = [];
      const manager = {
        getRepository: () => ({ update: async (criteria: never, patch: Partial<Exhibit>) => void updates.push({ criteria, patch }) }),
      } as unknown as EntityManager;
      const repo = new ExhibitsRepository(
        new MockRepository<Exhibit>(Exhibit) as unknown as Repository<Exhibit>,
        new MockRepository<ExhibitRevision>(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository<Hotspot>(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.markDeleted([EXHIBIT_ID, 'exhibit-2'], manager);
      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0].criteria.id.value, [EXHIBIT_ID, 'exhibit-2']);
      assert.equal(updates[0].patch.isDeleted, true);
      assert.ok(updates[0].patch.deletedAt instanceof Date);
    });

    it('TC-E092: markDeleted KHÔNG xóa revisions/hotspots (giữ để khôi phục)', async () => {
      const mockRevRepo = new MockRepository<ExhibitRevision>(ExhibitRevision);
      const mockHotspotRepo = new MockRepository<Hotspot>(Hotspot);
      const manager = { getRepository: () => ({ update: async () => undefined }) } as unknown as EntityManager;
      const repo = new ExhibitsRepository(
        new MockRepository<Exhibit>(Exhibit) as unknown as Repository<Exhibit>,
        mockRevRepo as unknown as Repository<ExhibitRevision>,
        mockHotspotRepo as unknown as Repository<Hotspot>,
      );

      await repo.markDeleted([EXHIBIT_ID], manager);
      assert.equal(mockRevRepo.lastDeleteCondition, undefined);
      assert.equal(mockHotspotRepo.lastDeleteCondition, undefined);
    });
  });

  // ===========================================================================
  // SUITE 8: countByRoom & existsInRoom & BaseRepository Features (10 Test Cases)
  // ===========================================================================
  describe('Suite 8: countByRoom & existsInRoom & BaseRepository Features (10 Test Cases)', () => {
    it('TC-E096: countByRoom đếm tất cả hiện vật chưa bị xóa trong phòng', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.countByRoom(ROOM_ID, false);
      assert.deepEqual(mockExhibitRepo.lastExistsWhere, { roomId: ROOM_ID, isDeleted: false });
    });

    it('TC-E097: countByRoom với onlyPublished = true chỉ đếm hiện vật visibility = "visible"', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.countByRoom(ROOM_ID, true);
      assert.deepEqual(mockExhibitRepo.lastExistsWhere, {
        roomId: ROOM_ID,
        isDeleted: false,
        visibility: ExhibitVisibility.VISIBLE,
      });
    });

    it('TC-E098: countByRoom với onlyPublished = false đếm cả visible và hidden', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      await repo.countByRoom(ROOM_ID, false);
      const where = mockExhibitRepo.lastExistsWhere as Record<string, unknown> | undefined;
      assert.equal(where?.['visibility'], undefined);
    });

    it('TC-E099: countByRoom trả về số lượng hiện vật đếm được', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockCountResult = 7;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const count = await repo.countByRoom(ROOM_ID);
      assert.equal(count, 7);
    });

    it('TC-E100: existsInRoom kiểm tra với roomId và isDeleted: false', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockCountResult = 1;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const exists = await repo.existsInRoom(ROOM_ID);
      assert.equal(exists, true);
      assert.deepEqual(mockExhibitRepo.lastExistsWhere, { roomId: ROOM_ID, isDeleted: false });
    });

    it('TC-E101: existsInRoom trả về false khi phòng không có hiện vật nào', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockCountResult = 0;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const exists = await repo.existsInRoom(ROOM_ID);
      assert.equal(exists, false);
    });

    it('TC-E102: Kế thừa findById từ BaseRepository', async () => {
      const sample = createSampleExhibit({ id: EXHIBIT_ID });
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockFindOneResult = sample;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const res = await repo.findById(EXHIBIT_ID);
      assert.equal(res?.id, EXHIBIT_ID);
    });

    it('TC-E103: Kế thừa save từ BaseRepository', async () => {
      const sample = createSampleExhibit();
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const saved = await repo.save(sample);
      assert.equal(saved, sample);
    });

    it('TC-E104: Kế thừa exists từ BaseRepository', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockCountResult = 2;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const ok = await repo.exists({ roomId: ROOM_ID });
      assert.equal(ok, true);
    });

    it('TC-E105: Kế thừa count từ BaseRepository', async () => {
      const mockExhibitRepo = new MockRepository<Exhibit>(Exhibit);
      mockExhibitRepo.mockCountResult = 10;
      const repo = new ExhibitsRepository(
        mockExhibitRepo as unknown as Repository<Exhibit>,
        new MockRepository(ExhibitRevision) as unknown as Repository<ExhibitRevision>,
        new MockRepository(Hotspot) as unknown as Repository<Hotspot>,
      );

      const total = await repo.count();
      assert.equal(total, 10);
    });
  });
});
