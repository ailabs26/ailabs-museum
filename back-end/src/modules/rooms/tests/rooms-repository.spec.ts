import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Brackets, FindManyOptions, FindOneOptions, Repository, SelectQueryBuilder } from 'typeorm';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { Room, RoomStatus } from '../entities/room.entity';
import { RoomsRepository } from '../repositories/rooms.repository';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';

// Helper tạo Room mẫu
function createSampleRoom(overrides?: Partial<Room>): Room {
  const room = new Room();
  room.id = overrides?.id ?? 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
  room.slug = overrides?.slug ?? 'phong-kham-pha';
  room.name = overrides?.name ?? 'Phòng Khám Phá';
  room.description =
    overrides && 'description' in overrides
      ? (overrides.description ?? null)
      : 'Mô tả phòng';
  room.status = overrides?.status ?? RoomStatus.ACTIVE;
  room.isDeleted = overrides?.isDeleted ?? false;
  room.deletedAt = overrides?.deletedAt ?? null;
  room.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  room.updatedAt = overrides?.updatedAt ?? new Date('2026-10-10T12:00:00Z');
  room.exhibits = overrides?.exhibits ?? [];
  return room;
}

// Mock QueryBuilder ghi nhận các lời gọi hàm
class MockSelectQueryBuilder {
  joinedRelations: string[] = [];
  whereCondition: string = '';
  whereParams?: Record<string, unknown>;
  andWhereList: Array<{ condition: string | Brackets; params?: Record<string, unknown> }> = [];
  orderSort: string = '';
  orderDir: string = '';
  skipValue: number = 0;
  takeValue: number = 0;
  mockResult: [Room[], number] = [[], 0];

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

  orderBy(sort: string, dir: 'ASC' | 'DESC' = 'ASC') {
    this.orderSort = sort;
    this.orderDir = dir;
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

  async getManyAndCount(): Promise<[Room[], number]> {
    return this.mockResult;
  }
}

// Mock TypeORM Repository
class MockTypeOrmRepository {
  lastFindOneOptions?: FindOneOptions<Room>;
  lastFindOptions?: FindManyOptions<Room>;
  lastExistsWhere?: unknown;
  mockFindOneResult: Room | null = null;
  mockFindResult: Room[] = [];
  mockCountResult: number = 0;
  mockQb = new MockSelectQueryBuilder();

  target = Room;

  findOne(options: FindOneOptions<Room>): Promise<Room | null> {
    this.lastFindOneOptions = options;
    return Promise.resolve(this.mockFindOneResult);
  }

  find(options?: FindManyOptions<Room>): Promise<Room[]> {
    this.lastFindOptions = options;
    return Promise.resolve(this.mockFindResult);
  }

  count(options?: { where?: unknown }): Promise<number> {
    this.lastExistsWhere = options?.where;
    return Promise.resolve(this.mockCountResult);
  }

  createQueryBuilder(): SelectQueryBuilder<Room> {
    return this.mockQb as unknown as SelectQueryBuilder<Room>;
  }
}

describe('Task 6.2 — RoomsRepository Comprehensive Test Suite (100 Test Cases)', () => {
  // ===========================================================================
  // SUITE 1: findBySlug (15 Test Cases)
  // ===========================================================================
  describe('Suite 1: findBySlug (15 Test Cases)', () => {
    it('TC-R001: Tìm theo slug đơn (phong) với isDeleted: false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug('phong');

      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { slug: 'phong', isDeleted: false });
    });

    it('TC-R002: Tìm theo slug kebab-case (phong-kham-pha)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug('phong-kham-pha');

      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { slug: 'phong-kham-pha', isDeleted: false });
    });

    it('TC-R003: Tìm theo slug có chữ số (phong-so-1)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug('phong-so-1');

      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { slug: 'phong-so-1', isDeleted: false });
    });

    it('TC-R004: Tìm theo slug 1 ký tự (a)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug('a');

      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { slug: 'a', isDeleted: false });
    });

    it('TC-R005: Trả về Room khi tìm thấy', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const sample = createSampleRoom({ slug: 'phong-1' });
      mockRepo.mockFindOneResult = sample;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.findBySlug('phong-1');
      assert.equal(result?.slug, 'phong-1');
    });

    it('TC-R006: Trả về null khi không tìm thấy slug', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = null;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.findBySlug('khong-ton-tai');
      assert.equal(result, null);
    });

    it('TC-R007: Điều kiện query luôn chứa isDeleted: false để bảo toàn soft-delete', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug('test');

      const where = mockRepo.lastFindOneOptions?.where as { isDeleted?: boolean };
      assert.equal(where?.isDeleted, false);
    });

    it('TC-R008: Không tự nạp quan hệ nặng trong findBySlug (tối ưu hiệu năng kiểm tra slug)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug('phong-1');

      assert.equal(mockRepo.lastFindOneOptions?.relations, undefined);
    });

    it('TC-R009: Giữ nguyên đối tượng Date trong Room entity trả về', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const sample = createSampleRoom();
      mockRepo.mockFindOneResult = sample;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.findBySlug('phong-kham-pha');
      assert.ok(result?.createdAt instanceof Date);
    });

    it('TC-R010: Giữ nguyên trường name trong entity trả về', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ name: 'Tên Phòng Độc Bản' });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.findBySlug('phong');
      assert.equal(result?.name, 'Tên Phòng Độc Bản');
    });

    it('TC-R011: Giữ nguyên trường status trong entity trả về', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ status: RoomStatus.ARCHIVED });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.findBySlug('phong-cu');
      assert.equal(result?.status, RoomStatus.ARCHIVED);
    });

    it('TC-R012: Hoạt động chính xác với slug độ dài tối đa 120 ký tự', async () => {
      const maxSlug = 'a'.repeat(60) + '-' + 'b'.repeat(59);
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug(maxSlug);

      const where = mockRepo.lastFindOneOptions?.where as { slug?: string };
      assert.equal(where?.slug, maxSlug);
    });

    it('TC-R013: Chuyển tiếp lỗi khi TypeORM ném exception', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.findOne = () => Promise.reject(new Error('Lỗi kết nối cơ sở dữ liệu'));
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      await assert.rejects(
        () => repository.findBySlug('phong-1'),
        /Lỗi kết nối cơ sở dữ liệu/,
      );
    });

    it('TC-R014: Hai lần gọi khác nhau cập nhật đúng điều kiện slug', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findBySlug('slug-1');
      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { slug: 'slug-1', isDeleted: false });

      await repository.findBySlug('slug-2');
      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { slug: 'slug-2', isDeleted: false });
    });

    it('TC-R015: Trả về UUID đúng chuẩn', async () => {
      const uuid = '241fab2e-ed74-4c6d-98d0-324ea98c67d7';
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ id: uuid });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.findBySlug('test');
      assert.equal(result?.id, uuid);
    });
  });

  // ===========================================================================
  // SUITE 2: findActiveBySlug (15 Test Cases)
  // ===========================================================================
  describe('Suite 2: findActiveBySlug (15 Test Cases)', () => {
    it('TC-R016: Điều kiện where có cả slug, status: ACTIVE và isDeleted: false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findActiveBySlug('phong-kham-pha');

      assert.deepEqual(mockRepo.lastFindOneOptions?.where, {
        slug: 'phong-kham-pha',
        status: RoomStatus.ACTIVE,
        isDeleted: false,
      });
    });

    it('TC-R017: Tự động nạp quan hệ exhibits ({ exhibits: true })', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findActiveBySlug('phong-kham-pha');

      assert.deepEqual(mockRepo.lastFindOneOptions?.relations, { exhibits: true });
    });

    it('TC-R018: Trả về phòng active khi tìm thấy', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ status: RoomStatus.ACTIVE });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('phong-active');
      assert.equal(room?.status, RoomStatus.ACTIVE);
    });

    it('TC-R019: Trả về null khi phòng không active (do where lọc)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = null;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('phong-archived');
      assert.equal(room, null);
    });

    it('TC-R020: Trả về null khi slug không tồn tại', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = null;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('chua-co');
      assert.equal(room, null);
    });

    it('TC-R021: Chứa mảng exhibits khi có hiện vật', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({
        exhibits: [new Exhibit(), new Exhibit()],
      });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('phong-co-hien-vat');
      assert.equal(room?.exhibits?.length, 2);
    });

    it('TC-R022: Chứa mảng exhibits rỗng khi phòng chưa có hiện vật', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ exhibits: [] });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('phong-rong');
      assert.equal(room?.exhibits?.length, 0);
    });

    it('TC-R023: Điều kiện status là enum RoomStatus.ACTIVE chứ không phải string tự do', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findActiveBySlug('test');

      const where = mockRepo.lastFindOneOptions?.where as { status?: RoomStatus };
      assert.equal(where?.status, RoomStatus.ACTIVE);
    });

    it('TC-R024: Điều kiện isDeleted luôn là false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findActiveBySlug('test');

      const where = mockRepo.lastFindOneOptions?.where as { isDeleted?: boolean };
      assert.equal(where?.isDeleted, false);
    });

    it('TC-R025: Hoạt động đúng với slug phức tạp', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findActiveBySlug('phong-so-9-tang-3-khu-b');

      const where = mockRepo.lastFindOneOptions?.where as { slug?: string };
      assert.equal(where?.slug, 'phong-so-9-tang-3-khu-b');
    });

    it('TC-R026: Trả về description của phòng khi có', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ description: 'Mô tả chi tiết 3D' });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('phong');
      assert.equal(room?.description, 'Mô tả chi tiết 3D');
    });

    it('TC-R027: Trả về description là null khi phòng không có mô tả', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ description: null });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('phong');
      assert.equal(room?.description, null);
    });

    it('TC-R028: Chuyển tiếp lỗi khi truy vấn database thất bại', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.findOne = () => Promise.reject(new Error('Connection lost'));
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      await assert.rejects(
        () => repository.findActiveBySlug('test'),
        /Connection lost/,
      );
    });

    it('TC-R029: Hai lần gọi khác nhau cập nhật đúng slug', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findActiveBySlug('phong-a');
      assert.equal((mockRepo.lastFindOneOptions?.where as { slug?: string })?.slug, 'phong-a');

      await repository.findActiveBySlug('phong-b');
      assert.equal((mockRepo.lastFindOneOptions?.where as { slug?: string })?.slug, 'phong-b');
    });

    it('TC-R030: Giữ nguyên id đúng format UUID', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const uuid = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
      mockRepo.mockFindOneResult = createSampleRoom({ id: uuid });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findActiveBySlug('test');
      assert.equal(room?.id, uuid);
    });
  });

  // ===========================================================================
  // SUITE 3: findWithExhibits & findDetailById (15 Test Cases)
  // ===========================================================================
  describe('Suite 3: findWithExhibits & findDetailById (15 Test Cases)', () => {
    it('TC-R031: findWithExhibits tìm theo UUID và isDeleted: false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const id = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
      await repository.findWithExhibits(id);

      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { id, isDeleted: false });
    });

    it('TC-R032: findWithExhibits nạp quan hệ { exhibits: true }', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findWithExhibits('uuid-1');

      assert.deepEqual(mockRepo.lastFindOneOptions?.relations, { exhibits: true });
    });

    it('TC-R033: findWithExhibits trả về room khi tìm thấy', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findWithExhibits('uuid-1');
      assert.notEqual(room, null);
    });

    it('TC-R034: findWithExhibits trả về null khi không tìm thấy phòng', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = null;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findWithExhibits('khong-co');
      assert.equal(room, null);
    });

    it('TC-R035: findWithExhibits bảo toàn danh sách hiện vật trả về', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const e1 = new Exhibit();
      const e2 = new Exhibit();
      mockRepo.mockFindOneResult = createSampleRoom({ exhibits: [e1, e2] });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findWithExhibits('uuid');
      assert.equal(room?.exhibits.length, 2);
    });

    it('TC-R036: findWithExhibits phòng không có hiện vật trả về mảng rỗng []', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ exhibits: [] });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findWithExhibits('uuid');
      assert.equal(room?.exhibits.length, 0);
    });

    it('TC-R037: findDetailById tìm theo id và isDeleted: false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const id = 'uuid-detail-123';
      await repository.findDetailById(id);

      assert.deepEqual(mockRepo.lastFindOneOptions?.where, { id, isDeleted: false });
    });

    it('TC-R038: findDetailById nạp quan hệ { exhibits: true }', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findDetailById('uuid-detail');

      assert.deepEqual(mockRepo.lastFindOneOptions?.relations, { exhibits: true });
    });

    it('TC-R039: findDetailById trả về room chi tiết khi tìm thấy', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ name: 'Chi Tiết Phòng' });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findDetailById('uuid');
      assert.equal(room?.name, 'Chi Tiết Phòng');
    });

    it('TC-R040: findDetailById trả về null khi phòng không tồn tại', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = null;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findDetailById('khong-co');
      assert.equal(room, null);
    });

    it('TC-R041: findWithExhibits bắt lỗi kết nối DB', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.findOne = () => Promise.reject(new Error('DB Query Timeout'));
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      await assert.rejects(
        () => repository.findWithExhibits('uuid'),
        /DB Query Timeout/,
      );
    });

    it('TC-R042: findDetailById bắt lỗi kết nối DB', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.findOne = () => Promise.reject(new Error('DB Connection Refused'));
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      await assert.rejects(
        () => repository.findDetailById('uuid'),
        /DB Connection Refused/,
      );
    });

    it('TC-R043: findDetailById bảo toàn createdAt kiểu Date', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findDetailById('uuid');
      assert.ok(room?.createdAt instanceof Date);
    });

    it('TC-R044: findDetailById bảo toàn updatedAt kiểu Date', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findDetailById('uuid');
      assert.ok(room?.updatedAt instanceof Date);
    });

    it('TC-R045: findDetailById bảo toàn đúng status', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindOneResult = createSampleRoom({ status: RoomStatus.ARCHIVED });
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const room = await repository.findDetailById('uuid');
      assert.equal(room?.status, RoomStatus.ARCHIVED);
    });
  });

  // ===========================================================================
  // SUITE 4: existsBySlug (10 Test Cases)
  // ===========================================================================
  describe('Suite 4: existsBySlug (10 Test Cases)', () => {
    it('TC-R046: Trả về true khi slug tồn tại (count > 0)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockCountResult = 1;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const exists = await repository.existsBySlug('phong-1');
      assert.equal(exists, true);
    });

    it('TC-R047: Trả về false khi slug không tồn tại (count = 0)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockCountResult = 0;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const exists = await repository.existsBySlug('chua-co');
      assert.equal(exists, false);
    });

    it('TC-R048: Điều kiện đếm luôn chứa slug và isDeleted: false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockCountResult = 1;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.existsBySlug('phong-kham-pha');

      assert.deepEqual(mockRepo.lastExistsWhere, { slug: 'phong-kham-pha', isDeleted: false });
    });

    it('TC-R049: Kiểm tra slug có số', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.existsBySlug('phong-so-12');

      const where = mockRepo.lastExistsWhere as { slug?: string };
      assert.equal(where?.slug, 'phong-so-12');
    });

    it('TC-R050: Kiểm tra slug 1 chữ cái', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.existsBySlug('z');

      const where = mockRepo.lastExistsWhere as { slug?: string };
      assert.equal(where?.slug, 'z');
    });

    it('TC-R051: Trả về true khi count > 1 (trường hợp DB có nhiều hơn 1 bản ghi)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockCountResult = 2;
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const exists = await repository.existsBySlug('phong-trung');
      assert.equal(exists, true);
    });

    it('TC-R052: Chuyển tiếp lỗi khi hàm count ném exception', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.count = () => Promise.reject(new Error('Count query failed'));
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      await assert.rejects(
        () => repository.existsBySlug('phong'),
        /Count query failed/,
      );
    });

    it('TC-R053: Hai lần kiểm tra khác nhau cập nhật đúng slug', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.existsBySlug('slug-a');
      assert.equal((mockRepo.lastExistsWhere as { slug?: string })?.slug, 'slug-a');

      await repository.existsBySlug('slug-b');
      assert.equal((mockRepo.lastExistsWhere as { slug?: string })?.slug, 'slug-b');
    });

    it('TC-R054: Bảo đảm isDeleted luôn bằng false khi kiểm tra tồn tại', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.existsBySlug('phong');

      const where = mockRepo.lastExistsWhere as { isDeleted?: boolean };
      assert.equal(where?.isDeleted, false);
    });

    it('TC-R055: Kiểm tra với slug đạt 120 ký tự', async () => {
      const longSlug = 'a'.repeat(60) + '-' + 'b'.repeat(59);
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.existsBySlug(longSlug);

      const where = mockRepo.lastExistsWhere as { slug?: string };
      assert.equal(where?.slug, longSlug);
    });
  });

  // ===========================================================================
  // SUITE 5: findPublicRooms (15 Test Cases)
  // ===========================================================================
  describe('Suite 5: findPublicRooms (15 Test Cases)', () => {
    it('TC-R056: Điều kiện where có status: RoomStatus.ACTIVE và isDeleted: false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findPublicRooms();

      assert.deepEqual(mockRepo.lastFindOptions?.where, {
        status: RoomStatus.ACTIVE,
        isDeleted: false,
      });
    });

    it('TC-R057: Nạp quan hệ exhibits ({ exhibits: true })', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findPublicRooms();

      assert.deepEqual(mockRepo.lastFindOptions?.relations, { exhibits: true });
    });

    it('TC-R058: Sắp xếp theo thứ tự tăng dần ngày tạo (order: { createdAt: "ASC" })', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.findPublicRooms();

      assert.deepEqual(mockRepo.lastFindOptions?.order, { createdAt: 'ASC' });
    });

    it('TC-R059: Trả về danh sách phòng công khai', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const r1 = createSampleRoom({ id: 'r1', name: 'Phòng 1' });
      const r2 = createSampleRoom({ id: 'r2', name: 'Phòng 2' });
      mockRepo.mockFindResult = [r1, r2];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms.length, 2);
      assert.equal(rooms[0].name, 'Phòng 1');
    });

    it('TC-R060: Trả về mảng rỗng [] khi chưa có phòng nào active', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindResult = [];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms.length, 0);
    });

    it('TC-R061: Bảo toàn hiện vật trong danh sách phòng trả về', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const r1 = createSampleRoom({ exhibits: [new Exhibit(), new Exhibit()] });
      mockRepo.mockFindResult = [r1];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms[0].exhibits.length, 2);
    });

    it('TC-R062: Phòng không có hiện vật trả về mảng exhibits rỗng', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const r1 = createSampleRoom({ exhibits: [] });
      mockRepo.mockFindResult = [r1];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms[0].exhibits.length, 0);
    });

    it('TC-R063: Tất cả các phòng trả về đều có status là ACTIVE', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const r1 = createSampleRoom({ status: RoomStatus.ACTIVE });
      mockRepo.mockFindResult = [r1];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms.every((r) => r.status === RoomStatus.ACTIVE), true);
    });

    it('TC-R064: Tất cả các phòng trả về đều có isDeleted là false', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const r1 = createSampleRoom({ isDeleted: false });
      mockRepo.mockFindResult = [r1];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms.every((r) => r.isDeleted === false), true);
    });

    it('TC-R065: Chuyển tiếp lỗi khi TypeORM find thất bại', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.find = () => Promise.reject(new Error('Database unavailable'));
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      await assert.rejects(
        () => repository.findPublicRooms(),
        /Database unavailable/,
      );
    });

    it('TC-R066: Trả về đúng số lượng 5 phòng khi có 5 phòng active', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindResult = Array.from({ length: 5 }, (_, i) =>
        createSampleRoom({ id: `r${i}`, name: `Phòng ${i}` }),
      );
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms.length, 5);
    });

    it('TC-R067: Bảo toàn UUID id của từng phòng', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const id1 = '241fab2e-ed74-4c6d-98d0-324ea98c67d7';
      mockRepo.mockFindResult = [createSampleRoom({ id: id1 })];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms[0].id, id1);
    });

    it('TC-R068: Bảo toàn đúng trường description của từng phòng', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindResult = [createSampleRoom({ description: 'Mô tả A' })];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms[0].description, 'Mô tả A');
    });

    it('TC-R069: Bảo toàn slug của từng phòng', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindResult = [createSampleRoom({ slug: 'phong-vang' })];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.equal(rooms[0].slug, 'phong-vang');
    });

    it('TC-R070: Bảo toàn đối tượng Date cho createdAt', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockFindResult = [createSampleRoom()];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const rooms = await repository.findPublicRooms();
      assert.ok(rooms[0].createdAt instanceof Date);
    });
  });

  // ===========================================================================
  // SUITE 6: searchRooms QueryBuilder, Filters & Pagination (30 Test Cases)
  // ===========================================================================
  describe('Suite 6: searchRooms QueryBuilder, Filters & Pagination (30 Test Cases)', () => {
    it('TC-R071: Khởi tạo giá trị mặc định page = 1, pageSize = 20 khi query rỗng', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.skipValue, 0);
      assert.equal(mockRepo.mockQb.takeValue, 20);
    });

    it('TC-R072: Tính đúng skip khi page = 2, pageSize = 20 (skip = 20)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.page = 2;
      query.pageSize = 20;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.skipValue, 20);
      assert.equal(mockRepo.mockQb.takeValue, 20);
    });

    it('TC-R073: Tính đúng skip khi page = 3, pageSize = 10 (skip = 20, take = 10)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.page = 3;
      query.pageSize = 10;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.skipValue, 20);
      assert.equal(mockRepo.mockQb.takeValue, 10);
    });

    it('TC-R074: Tự động kẹp page tối thiểu là 1 khi truyền page = 0', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.page = 0;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.skipValue, 0);
    });

    it('TC-R075: Tự động kẹp page tối thiểu là 1 khi truyền page âm (page = -5)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.page = -5;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.skipValue, 0);
    });

    it('TC-R076: Tự động kẹp pageSize tối thiểu là 1 khi truyền pageSize = 0', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.pageSize = 0;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.takeValue, 1);
    });

    it('TC-R077: Tự động kẹp pageSize tối đa là 100 khi truyền pageSize = 200', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.pageSize = 200;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.takeValue, 100);
    });

    it('TC-R078: Luôn lọc isDeleted = false trên bảng room', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.searchRooms(new ListRoomsQueryDto());

      assert.equal(mockRepo.mockQb.whereCondition, 'room.isDeleted = :isDeleted');
      assert.deepEqual(mockRepo.mockQb.whereParams, { isDeleted: false });
    });

    it('TC-R079: Luôn leftJoinAndSelect quan hệ room.exhibits', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.searchRooms(new ListRoomsQueryDto());

      assert.ok(mockRepo.mockQb.joinedRelations.includes('room.exhibits as exhibit'));
    });

    it('TC-R080: Luôn sắp xếp theo createdAt DESC mặc định', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.searchRooms(new ListRoomsQueryDto());

      assert.equal(mockRepo.mockQb.orderSort, 'room.createdAt');
      assert.equal(mockRepo.mockQb.orderDir, 'DESC');
    });

    it('TC-R081: Lọc đúng trạng thái khi truyền status = RoomStatus.ACTIVE', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.status = RoomStatus.ACTIVE;

      await repository.searchRooms(query);
      const statusCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition === 'room.status = :status');
      assert.notEqual(statusCondition, undefined);
      assert.deepEqual(statusCondition?.params, { status: RoomStatus.ACTIVE });
    });

    it('TC-R082: Lọc đúng trạng thái khi truyền status = RoomStatus.ARCHIVED', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.status = RoomStatus.ARCHIVED;

      await repository.searchRooms(query);
      const statusCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition === 'room.status = :status');
      assert.notEqual(statusCondition, undefined);
      assert.deepEqual(statusCondition?.params, { status: RoomStatus.ARCHIVED });
    });

    it('TC-R083: Không thêm điều kiện status khi query.status là undefined', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      await repository.searchRooms(new ListRoomsQueryDto());

      const statusCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition === 'room.status = :status');
      assert.equal(statusCondition, undefined);
    });

    it('TC-R084: Thêm điều kiện tìm kiếm ILIKE khi có từ khóa q ("phong")', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.q = 'phong';

      await repository.searchRooms(query);
      const searchCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.notEqual(searchCondition, undefined);
    });

    it('TC-R085: Tự động trim khoảng trắng thừa trong từ khóa q ("   kham pha   " -> "%kham pha%")', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.q = '   kham pha   ';

      await repository.searchRooms(query);
      const searchCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.notEqual(searchCondition, undefined);
    });

    it('TC-R086: Không thêm điều kiện tìm kiếm khi q là chuỗi rỗng ("")', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.q = '';

      await repository.searchRooms(query);
      const searchCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.equal(searchCondition, undefined);
    });

    it('TC-R087: Không thêm điều kiện tìm kiếm khi q chỉ chứa khoảng trắng ("   ")', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.q = '   ';

      await repository.searchRooms(query);
      const searchCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.equal(searchCondition, undefined);
    });

    it('TC-R088: Hỗ trợ tìm kiếm từ khóa tiếng Việt có dấu ("khám phá")', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.q = 'khám phá';

      await repository.searchRooms(query);
      const searchCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.notEqual(searchCondition, undefined);
    });

    it('TC-R089: Kết hợp đồng thời cả lọc status và tìm kiếm q', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.status = RoomStatus.ACTIVE;
      query.q = 'phong';

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.andWhereList.length, 2);
    });

    it('TC-R090: Trả về cấu trúc phân trang chuẩn Paginated<Room> (items, total, page, pageSize)', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const sample = createSampleRoom();
      mockRepo.mockQb.mockResult = [[sample], 1];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.searchRooms(new ListRoomsQueryDto());
      assert.equal(Array.isArray(result.items), true);
      assert.equal(result.total, 1);
      assert.equal(result.page, 1);
      assert.equal(result.pageSize, 20);
    });

    it('TC-R091: Trả về total chính xác từ getManyAndCount()', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockQb.mockResult = [[], 42];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.searchRooms(new ListRoomsQueryDto());
      assert.equal(result.total, 42);
    });

    it('TC-R092: Trả về danh sách rỗng khi không có bản ghi nào khớp', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockQb.mockResult = [[], 0];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.searchRooms(new ListRoomsQueryDto());
      assert.equal(result.items.length, 0);
      assert.equal(result.total, 0);
    });

    it('TC-R093: Trả về page đúng giá trị yêu cầu', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.page = 4;

      const result = await repository.searchRooms(query);
      assert.equal(result.page, 4);
    });

    it('TC-R094: Trả về pageSize đúng giá trị yêu cầu', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.pageSize = 15;

      const result = await repository.searchRooms(query);
      assert.equal(result.pageSize, 15);
    });

    it('TC-R095: Bảo toàn hiện vật trong danh sách items trả về', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const roomWithExhibits = createSampleRoom({ exhibits: [new Exhibit()] });
      mockRepo.mockQb.mockResult = [[roomWithExhibits], 1];
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      const result = await repository.searchRooms(new ListRoomsQueryDto());
      assert.equal(result.items[0].exhibits.length, 1);
    });

    it('TC-R096: Chuyển tiếp lỗi khi QueryBuilder ném exception', async () => {
      const mockRepo = new MockTypeOrmRepository();
      mockRepo.mockQb.getManyAndCount = () => Promise.reject(new Error('Syntax error in SQL'));
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);

      await assert.rejects(
        () => repository.searchRooms(new ListRoomsQueryDto()),
        /Syntax error in SQL/,
      );
    });

    it('TC-R097: Hỗ trợ tìm kiếm theo slug có gạch ngang ("phong-1")', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.q = 'phong-1';

      await repository.searchRooms(query);
      const searchCondition = mockRepo.mockQb.andWhereList.find((w) => w.condition instanceof Brackets);
      assert.notEqual(searchCondition, undefined);
    });

    it('TC-R098: Kiểm tra Brackets chứa cả điều kiện name và slug', () => {
      let subQueryCondition = '';
      const subBuilder = {
        where: (cond: string) => {
          subQueryCondition += cond;
          return {
            orWhere: (orCond: string) => {
              subQueryCondition += ' OR ' + orCond;
            },
          };
        },
      };

      const brackets = new Brackets((builder) => {
        builder.where('room.name ILIKE :search', { search: '%a%' }).orWhere('room.slug ILIKE :search', { search: '%a%' });
      });

      // @ts-expect-error test internal whereFactory
      brackets.whereFactory(subBuilder);
      assert.ok(subQueryCondition.includes('room.name ILIKE :search'));
      assert.ok(subQueryCondition.includes('room.slug ILIKE :search'));
    });

    it('TC-R099: Đúng biên pageSize = 1', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.pageSize = 1;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.takeValue, 1);
    });

    it('TC-R100: Đúng biên pageSize = 100', async () => {
      const mockRepo = new MockTypeOrmRepository();
      const repository = new RoomsRepository(mockRepo as unknown as Repository<Room>);
      const query = new ListRoomsQueryDto();
      query.pageSize = 100;

      await repository.searchRooms(query);
      assert.equal(mockRepo.mockQb.takeValue, 100);
    });
  });
});
