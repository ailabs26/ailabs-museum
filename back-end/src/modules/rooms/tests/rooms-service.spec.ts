import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { Paginated } from '../../../common/types/paginated.type';
import { Exhibit, ExhibitVisibility } from '../../exhibits/entities/exhibit.entity';
import { CreateRoomDto } from '../dto/create-room.dto';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { Room, RoomStatus } from '../entities/room.entity';
import { RoomsRepository } from '../repositories/rooms.repository';
import { RoomsService } from '../services/rooms.service';

// Helper tạo Room mẫu cho testing
function createSampleRoom(overrides?: Partial<Room>): Room {
  const room = new Room();
  room.id = overrides?.id ?? 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
  room.slug = overrides?.slug ?? 'phong-kham-pha';
  room.name = overrides?.name ?? 'Phòng Khám Phá';
  room.description =
    overrides && 'description' in overrides
      ? (overrides.description ?? null)
      : 'Mô tả phòng khám phá';
  room.status = overrides?.status ?? RoomStatus.ACTIVE;
  room.isDeleted = overrides?.isDeleted ?? false;
  room.deletedAt = overrides?.deletedAt ?? null;
  room.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  room.updatedAt = overrides?.updatedAt ?? new Date('2026-10-10T12:00:00Z');
  room.exhibits = overrides?.exhibits ?? [];
  return room;
}

// Helper tạo Exhibit mẫu
function createSampleExhibit(overrides?: Partial<Exhibit>): Exhibit {
  const exhibit = new Exhibit();
  exhibit.id = overrides?.id ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  exhibit.roomId = overrides?.roomId ?? 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
  exhibit.visibility = overrides?.visibility ?? ExhibitVisibility.VISIBLE;
  exhibit.version = overrides?.version ?? 1;
  exhibit.displayOrder = overrides?.displayOrder ?? 0;
  exhibit.isDeleted = overrides?.isDeleted ?? false;
  exhibit.deletedAt = overrides?.deletedAt ?? null;
  exhibit.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  exhibit.updatedAt = overrides?.updatedAt ?? new Date('2026-10-10T10:00:00Z');
  return exhibit;
}

// Helper tạo ListRoomsQueryDto mẫu
function createSampleQuery(overrides?: Partial<ListRoomsQueryDto>): ListRoomsQueryDto {
  const query = new ListRoomsQueryDto();
  if (overrides) {
    Object.assign(query, overrides);
  }
  return query;
}

// Mock RoomsRepository độc lập ghi nhận calls và cung cấp kết quả tùy chỉnh
class MockRoomsRepository {
  searchRoomsCalls: ListRoomsQueryDto[] = [];
  searchRoomsResult: Paginated<Room> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  searchRoomsError?: Error;

  findWithExhibitsCalls: string[] = [];
  findWithExhibitsResult: Room | null = null;
  findWithExhibitsError?: Error;

  findPublicRoomsCallsCount = 0;
  findPublicRoomsResult: Room[] = [];
  findPublicRoomsError?: Error;

  findActiveBySlugCalls: string[] = [];
  findActiveBySlugResult: Room | null = null;
  findActiveBySlugError?: Error;

  findBySlugCalls: string[] = [];
  findBySlugResult: Room | null = null;
  findBySlugError?: Error;

  createCalls: Array<DeepPartial<Room>> = [];

  saveCalls: Array<Room | Room[]> = [];
  saveResult?: Room | Room[];
  saveError?: Error;

  async searchRooms(query: ListRoomsQueryDto): Promise<Paginated<Room>> {
    this.searchRoomsCalls.push(query);
    if (this.searchRoomsError) {
      throw this.searchRoomsError;
    }
    return this.searchRoomsResult;
  }

  async findWithExhibits(id: string): Promise<Room | null> {
    this.findWithExhibitsCalls.push(id);
    if (this.findWithExhibitsError) {
      throw this.findWithExhibitsError;
    }
    return this.findWithExhibitsResult;
  }

  async findPublicRooms(): Promise<Room[]> {
    this.findPublicRoomsCallsCount++;
    if (this.findPublicRoomsError) {
      throw this.findPublicRoomsError;
    }
    return this.findPublicRoomsResult;
  }

  async findActiveBySlug(slug: string): Promise<Room | null> {
    this.findActiveBySlugCalls.push(slug);
    if (this.findActiveBySlugError) {
      throw this.findActiveBySlugError;
    }
    return this.findActiveBySlugResult;
  }

  async findBySlug(slug: string): Promise<Room | null> {
    this.findBySlugCalls.push(slug);
    if (this.findBySlugError) {
      throw this.findBySlugError;
    }
    return this.findBySlugResult;
  }

  create(data: DeepPartial<Room>): Room {
    this.createCalls.push(data);
    const room = new Room();
    Object.assign(room, data);
    room.id = 'new-room-uuid-generated';
    room.status = RoomStatus.ACTIVE;
    room.isDeleted = false;
    room.deletedAt = null;
    room.createdAt = new Date('2026-10-12T10:00:00Z');
    room.updatedAt = new Date('2026-10-12T10:00:00Z');
    room.exhibits = [];
    return room;
  }

  async save(entity: Room | Room[]): Promise<Room | Room[]> {
    this.saveCalls.push(entity);
    if (this.saveError) {
      throw this.saveError;
    }
    if (this.saveResult !== undefined) {
      return this.saveResult;
    }
    return entity;
  }
}

describe('Task 6.3 — RoomsService Comprehensive Unit Test Suite (105 Test Cases)', () => {
  // =========================================================================
  // SUITE 1: list(query: ListRoomsQueryDto) (15 Test Cases: TC-S001 -> TC-S015)
  // =========================================================================
  describe('Suite 1: list (15 Test Cases)', () => {
    it('TC-S001: Trả về danh sách phân trang chuẩn Paginated<RoomResponse> khi repository trả về kết quả', async () => {
      const mockRepo = new MockRoomsRepository();
      const sample = createSampleRoom();
      mockRepo.searchRoomsResult = {
        items: [sample],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.strictEqual(res.total, 1);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.page, 1);
      assert.strictEqual(res.pageSize, 20);
    });

    it('TC-S002: Chuyển đổi chính xác các entity Room sang RoomResponse qua toRoomResponse', async () => {
      const mockRepo = new MockRoomsRepository();
      const sample = createSampleRoom({ id: 'room-uuid-002', slug: 'phong-lich-su', name: 'Phòng Lịch Sử' });
      mockRepo.searchRoomsResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      const item = res.items[0];
      assert.strictEqual(item.id, 'room-uuid-002');
      assert.strictEqual(item.slug, 'phong-lich-su');
      assert.strictEqual(item.name, 'Phòng Lịch Sử');
    });

    it('TC-S003: Tính đúng exhibitsCount dựa trên độ dài của mảng room.exhibits', async () => {
      const mockRepo = new MockRoomsRepository();
      const ex1 = createSampleExhibit();
      const ex2 = createSampleExhibit({ id: 'ex-002' });
      const sample = createSampleRoom({ exhibits: [ex1, ex2] });
      mockRepo.searchRoomsResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.strictEqual(res.items[0].exhibitsCount, 2);
    });

    it('TC-S004: Gán exhibitsCount = 0 khi room.exhibits là mảng rỗng []', async () => {
      const mockRepo = new MockRoomsRepository();
      const sample = createSampleRoom({ exhibits: [] });
      mockRepo.searchRoomsResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.strictEqual(res.items[0].exhibitsCount, 0);
    });

    it('TC-S005: Chuyển tiếp đúng tham số query (page, pageSize, status, q) tới roomsRepo.searchRooms', async () => {
      const mockRepo = new MockRoomsRepository();
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);
      const queryDto = createSampleQuery({
        page: 2,
        pageSize: 15,
        status: RoomStatus.ACTIVE,
        q: 'nghe-thuat',
      });

      await service.list(queryDto);
      assert.strictEqual(mockRepo.searchRoomsCalls.length, 1);
      assert.deepStrictEqual(mockRepo.searchRoomsCalls[0], queryDto);
    });

    it('TC-S006: Giữ nguyên metadata phân trang page và pageSize từ repository', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.searchRoomsResult = { items: [], total: 50, page: 3, pageSize: 15 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ page: 3, pageSize: 15 }));
      assert.strictEqual(res.page, 3);
      assert.strictEqual(res.pageSize, 15);
    });

    it('TC-S007: Giữ nguyên metadata tổng số total từ repository', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.searchRoomsResult = { items: [], total: 99, page: 1, pageSize: 10 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.strictEqual(res.total, 99);
    });

    it('TC-S008: Trả về danh sách rỗng (items: [], total: 0) khi không có phòng nào khớp truy vấn', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.searchRoomsResult = { items: [], total: 0, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ q: 'khong-ton-tai' }));
      assert.deepStrictEqual(res.items, []);
      assert.strictEqual(res.total, 0);
    });

    it('TC-S009: Xử lý đúng khi query mặc định được khởi tạo', async () => {
      const mockRepo = new MockRoomsRepository();
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.ok(Array.isArray(res.items));
      assert.strictEqual(mockRepo.searchRoomsCalls.length, 1);
    });

    it('TC-S010: Xử lý đúng khi query có lọc trạng thái status: RoomStatus.ACTIVE', async () => {
      const mockRepo = new MockRoomsRepository();
      const sample = createSampleRoom({ status: RoomStatus.ACTIVE });
      mockRepo.searchRoomsResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ status: RoomStatus.ACTIVE }));
      assert.strictEqual(res.items[0].status, RoomStatus.ACTIVE);
    });

    it('TC-S011: Xử lý đúng khi query có lọc trạng thái status: RoomStatus.ARCHIVED', async () => {
      const mockRepo = new MockRoomsRepository();
      const sample = createSampleRoom({ status: RoomStatus.ARCHIVED });
      mockRepo.searchRoomsResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ status: RoomStatus.ARCHIVED }));
      assert.strictEqual(res.items[0].status, RoomStatus.ARCHIVED);
    });

    it('TC-S012: Xử lý đúng khi query có từ khóa tìm kiếm q: "khám phá"', async () => {
      const mockRepo = new MockRoomsRepository();
      const sample = createSampleRoom({ name: 'Phòng Khám Phá' });
      mockRepo.searchRoomsResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ q: 'khám phá' }));
      assert.strictEqual(res.items[0].name, 'Phòng Khám Phá');
      assert.strictEqual(mockRepo.searchRoomsCalls[0].q, 'khám phá');
    });

    it('TC-S013: Xử lý danh sách có nhiều phòng với các số lượng hiện vật khác nhau', async () => {
      const mockRepo = new MockRoomsRepository();
      const r1 = createSampleRoom({ id: 'r1', exhibits: [] });
      const r2 = createSampleRoom({ id: 'r2', exhibits: [createSampleExhibit()] });
      const r3 = createSampleRoom({
        id: 'r3',
        exhibits: [createSampleExhibit(), createSampleExhibit({ id: 'ex2' })],
      });
      mockRepo.searchRoomsResult = { items: [r1, r2, r3], total: 3, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.strictEqual(res.items.length, 3);
      assert.strictEqual(res.items[0].exhibitsCount, 0);
      assert.strictEqual(res.items[1].exhibitsCount, 1);
      assert.strictEqual(res.items[2].exhibitsCount, 2);
    });

    it('TC-S014: Bảo toàn các kiểu dữ liệu ngày tháng (createdAt, updatedAt) kiểu Date', async () => {
      const mockRepo = new MockRoomsRepository();
      const createdAt = new Date('2026-05-01T08:00:00Z');
      const updatedAt = new Date('2026-05-02T09:00:00Z');
      const sample = createSampleRoom({ createdAt, updatedAt });
      mockRepo.searchRoomsResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.deepStrictEqual(res.items[0].createdAt, createdAt);
      assert.deepStrictEqual(res.items[0].updatedAt, updatedAt);
    });

    it('TC-S015: Ném lại ngoại lệ khi roomsRepo.searchRooms gặp lỗi cơ sở dữ liệu', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.searchRoomsError = new Error('Database connection failed');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.list(createSampleQuery());
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Database connection failed');
          return true;
        },
      );
    });
  });

  // =========================================================================
  // SUITE 2: getById(id: string) (15 Test Cases: TC-S016 -> TC-S030)
  // =========================================================================
  describe('Suite 2: getById (15 Test Cases)', () => {
    it('TC-S016: Trả về RoomResponse khi tìm thấy phòng theo ID', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ id: 'uuid-016' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('uuid-016');
      assert.strictEqual(res.id, 'uuid-016');
    });

    it('TC-S017: Gọi roomsRepo.findWithExhibits với đúng id được truyền vào', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ id: 'target-room-id' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.getById('target-room-id');
      assert.strictEqual(mockRepo.findWithExhibitsCalls.length, 1);
      assert.strictEqual(mockRepo.findWithExhibitsCalls[0], 'target-room-id');
    });

    it('TC-S018: Ném NotFoundException khi không tìm thấy phòng (repo trả về null)', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getById('non-existent-id');
        },
        (err: unknown) => {
          assert(err instanceof NotFoundException);
          return true;
        },
      );
    });

    it('TC-S019: Thông điệp ngoại lệ là "Không tìm thấy phòng trưng bày" khi không tìm thấy phòng', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getById('missing-id');
        },
        (err: NotFoundException) => {
          assert.strictEqual(err.message, 'Không tìm thấy phòng trưng bày');
          return true;
        },
      );
    });

    it('TC-S020: Ngoại lệ NotFoundException ném ra có HTTP status 404', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getById('missing-id');
        },
        (err: NotFoundException) => {
          assert.strictEqual(err.getStatus(), 404);
          return true;
        },
      );
    });

    it('TC-S021: Chuyển đổi chính xác exhibitsCount khi phòng có hiện vật', async () => {
      const mockRepo = new MockRoomsRepository();
      const ex1 = createSampleExhibit();
      const ex2 = createSampleExhibit({ id: 'ex-2' });
      mockRepo.findWithExhibitsResult = createSampleRoom({ exhibits: [ex1, ex2] });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.exhibitsCount, 2);
    });

    it('TC-S022: Chuyển đổi chính xác exhibitsCount = 0 khi phòng không có hiện vật', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ exhibits: [] });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.exhibitsCount, 0);
    });

    it('TC-S023: Bảo toàn trường description khi phòng có mô tả', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ description: 'Mô tả chi tiết phòng' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.description, 'Mô tả chi tiết phòng');
    });

    it('TC-S024: Bảo toàn trường description là null khi phòng không có mô tả', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ description: null });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.description, null);
    });

    it('TC-S025: Bảo toàn trường slug đúng nguyên bản', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ slug: 'phong-co-vat-thoi-ly' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.slug, 'phong-co-vat-thoi-ly');
    });

    it('TC-S026: Bảo toàn trường status ACTIVE', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ status: RoomStatus.ACTIVE });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.status, RoomStatus.ACTIVE);
    });

    it('TC-S027: Bảo toàn trường status ARCHIVED', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ status: RoomStatus.ARCHIVED });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.status, RoomStatus.ARCHIVED);
    });

    it('TC-S028: Cập nhật slug với độ dài lớn (100 ký tự)', async () => {
      const mockRepo = new MockRoomsRepository();
      const longSlug = 'p'.repeat(100);
      mockRepo.findWithExhibitsResult = createSampleRoom({ slug: longSlug });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById('room-id');
      assert.strictEqual(res.slug, longSlug);
    });

    it('TC-S029: Chuyển tiếp ngoại lệ khi roomsRepo.findWithExhibits gặp lỗi', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsError = new Error('Query error');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getById('room-id');
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Query error');
          return true;
        },
      );
    });

    it('TC-S030: Chấp nhận mọi chuỗi UUID hợp lệ làm ID phòng', async () => {
      const mockRepo = new MockRoomsRepository();
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      mockRepo.findWithExhibitsResult = createSampleRoom({ id: uuid });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getById(uuid);
      assert.strictEqual(res.id, uuid);
    });
  });

  // =========================================================================
  // SUITE 3: getPublicList() (15 Test Cases: TC-S031 -> TC-S045)
  // =========================================================================
  describe('Suite 3: getPublicList (15 Test Cases)', () => {
    it('TC-S031: Trả về mảng RoomResponse[] khi có các phòng công khai', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findPublicRoomsResult = [createSampleRoom()];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].slug, 'phong-kham-pha');
    });

    it('TC-S032: Gọi hàm roomsRepo.findPublicRooms đúng 1 lần', async () => {
      const mockRepo = new MockRoomsRepository();
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.getPublicList();
      assert.strictEqual(mockRepo.findPublicRoomsCallsCount, 1);
    });

    it('TC-S033: Trả về mảng rỗng [] khi không có phòng công khai nào', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findPublicRoomsResult = [];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.deepStrictEqual(res, []);
    });

    it('TC-S034: Chuyển đổi từng phần tử phòng sang RoomResponse', async () => {
      const mockRepo = new MockRoomsRepository();
      const r1 = createSampleRoom({ id: 'r-1', name: 'Phòng 1' });
      const r2 = createSampleRoom({ id: 'r-2', name: 'Phòng 2' });
      mockRepo.findPublicRoomsResult = [r1, r2];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.length, 2);
      assert.strictEqual(res[0].name, 'Phòng 1');
      assert.strictEqual(res[1].name, 'Phòng 2');
    });

    it('TC-S035: Tất cả các phòng trả về đều phản ánh đúng exhibitsCount', async () => {
      const mockRepo = new MockRoomsRepository();
      const ex1 = createSampleExhibit();
      const r1 = createSampleRoom({ exhibits: [ex1] });
      mockRepo.findPublicRoomsResult = [r1];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res[0].exhibitsCount, 1);
    });

    it('TC-S036: Các phòng không có hiện vật có exhibitsCount = 0', async () => {
      const mockRepo = new MockRoomsRepository();
      const r1 = createSampleRoom({ exhibits: [] });
      mockRepo.findPublicRoomsResult = [r1];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res[0].exhibitsCount, 0);
    });

    it('TC-S037: Tất cả các phòng trả về đều có trạng thái ACTIVE', async () => {
      const mockRepo = new MockRoomsRepository();
      const r1 = createSampleRoom({ status: RoomStatus.ACTIVE });
      const r2 = createSampleRoom({ id: 'r-2', status: RoomStatus.ACTIVE });
      mockRepo.findPublicRoomsResult = [r1, r2];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert(res.every((r) => r.status === RoomStatus.ACTIVE));
    });

    it('TC-S038: Bảo toàn thứ tự sắp xếp trả về từ repository', async () => {
      const mockRepo = new MockRoomsRepository();
      const r1 = createSampleRoom({ id: 'first-room', createdAt: new Date('2026-01-01') });
      const r2 = createSampleRoom({ id: 'second-room', createdAt: new Date('2026-01-02') });
      mockRepo.findPublicRoomsResult = [r1, r2];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res[0].id, 'first-room');
      assert.strictEqual(res[1].id, 'second-room');
    });

    it('TC-S039: Xử lý đúng khi danh sách chỉ có 1 phòng công khai', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findPublicRoomsResult = [createSampleRoom({ id: 'single-room' })];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 'single-room');
    });

    it('TC-S040: Xử lý đúng khi danh sách có nhiều phòng (5 phòng)', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findPublicRoomsResult = Array.from({ length: 5 }, (_, i) =>
        createSampleRoom({ id: `room-${i}`, slug: `slug-${i}`, name: `Phòng ${i}` }),
      );
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.length, 5);
      assert.strictEqual(res[4].slug, 'slug-4');
    });

    it('TC-S041: Giữ nguyên description chuỗi và null cho từng phòng tương ứng', async () => {
      const mockRepo = new MockRoomsRepository();
      const r1 = createSampleRoom({ id: 'r1', description: 'Có mô tả' });
      const r2 = createSampleRoom({ id: 'r2', description: null });
      mockRepo.findPublicRoomsResult = [r1, r2];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res[0].description, 'Có mô tả');
      assert.strictEqual(res[1].description, null);
    });

    it('TC-S042: Giữ nguyên đối tượng createdAt và updatedAt kiểu Date', async () => {
      const mockRepo = new MockRoomsRepository();
      const createdAt = new Date('2026-10-01T12:00:00Z');
      const updatedAt = new Date('2026-10-02T15:30:00Z');
      mockRepo.findPublicRoomsResult = [createSampleRoom({ createdAt, updatedAt })];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.deepStrictEqual(res[0].createdAt, createdAt);
      assert.deepStrictEqual(res[0].updatedAt, updatedAt);
    });

    it('TC-S043: Không rò rỉ các trường nội bộ không có trong RoomResponse', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findPublicRoomsResult = [createSampleRoom()];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      const item = res[0] as unknown as Record<string, unknown>;
      assert.strictEqual(item.isDeleted, undefined);
      assert.strictEqual(item.deletedAt, undefined);
      assert.strictEqual(item.exhibits, undefined);
    });

    it('TC-S044: Ném lại ngoại lệ khi roomsRepo.findPublicRooms ném lỗi', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findPublicRoomsError = new Error('Public rooms query error');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getPublicList();
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Public rooms query error');
          return true;
        },
      );
    });

    it('TC-S045: Đảm bảo không làm đột biến dữ liệu entity ban đầu', async () => {
      const mockRepo = new MockRoomsRepository();
      const sample = createSampleRoom();
      mockRepo.findPublicRoomsResult = [sample];
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(sample.slug, 'phong-kham-pha');
      assert.strictEqual(res[0].slug, sample.slug);
    });
  });

  // =========================================================================
  // SUITE 4: getPublicBySlug(slug: string) (15 Test Cases: TC-S046 -> TC-S060)
  // =========================================================================
  describe('Suite 4: getPublicBySlug (15 Test Cases)', () => {
    it('TC-S046: Trả về RoomResponse khi tìm thấy phòng active theo slug', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ slug: 'phong-dong-son' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-dong-son');
      assert.strictEqual(res.slug, 'phong-dong-son');
    });

    it('TC-S047: Gọi roomsRepo.findActiveBySlug với đúng slug truyền vào', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ slug: 'phong-giao-duc' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.getPublicBySlug('phong-giao-duc');
      assert.strictEqual(mockRepo.findActiveBySlugCalls.length, 1);
      assert.strictEqual(mockRepo.findActiveBySlugCalls[0], 'phong-giao-duc');
    });

    it('TC-S048: Ném NotFoundException khi slug không tồn tại (repo trả về null)', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getPublicBySlug('slug-khong-ton-tai');
        },
        (err: unknown) => {
          assert(err instanceof NotFoundException);
          return true;
        },
      );
    });

    it('TC-S049: Thông điệp ngoại lệ là "Không tìm thấy phòng trưng bày" khi không tìm thấy theo slug', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getPublicBySlug('missing-slug');
        },
        (err: NotFoundException) => {
          assert.strictEqual(err.message, 'Không tìm thấy phòng trưng bày');
          return true;
        },
      );
    });

    it('TC-S050: Ngoại lệ ném ra có HTTP status 404', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getPublicBySlug('missing-slug');
        },
        (err: NotFoundException) => {
          assert.strictEqual(err.getStatus(), 404);
          return true;
        },
      );
    });

    it('TC-S051: Trả về exhibitsCount chính xác khi phòng có hiện vật', async () => {
      const mockRepo = new MockRoomsRepository();
      const ex1 = createSampleExhibit();
      const ex2 = createSampleExhibit({ id: 'ex-2' });
      const ex3 = createSampleExhibit({ id: 'ex-3' });
      mockRepo.findActiveBySlugResult = createSampleRoom({ exhibits: [ex1, ex2, ex3] });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-kham-pha');
      assert.strictEqual(res.exhibitsCount, 3);
    });

    it('TC-S052: Trả về exhibitsCount = 0 khi phòng chưa có hiện vật', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ exhibits: [] });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-kham-pha');
      assert.strictEqual(res.exhibitsCount, 0);
    });

    it('TC-S053: Bảo toàn thông tin phòng với slug đơn giản ("phong-1")', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ slug: 'phong-1' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-1');
      assert.strictEqual(res.slug, 'phong-1');
    });

    it('TC-S054: Bảo toàn thông tin phòng với slug nhiều đoạn ("khu-trung-bay-van-hoa-dong-son")', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ slug: 'khu-trung-bay-van-hoa-dong-son' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('khu-trung-bay-van-hoa-dong-son');
      assert.strictEqual(res.slug, 'khu-trung-bay-van-hoa-dong-son');
    });

    it('TC-S055: Bảo toàn trường description dạng chuỗi', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ description: 'Mô tả chi tiết phòng VR' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-vr');
      assert.strictEqual(res.description, 'Mô tả chi tiết phòng VR');
    });

    it('TC-S056: Bảo toàn trường description là null', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ description: null });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-vr');
      assert.strictEqual(res.description, null);
    });

    it('TC-S057: Bảo toàn đúng status = RoomStatus.ACTIVE', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom({ status: RoomStatus.ACTIVE });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-vr');
      assert.strictEqual(res.status, RoomStatus.ACTIVE);
    });

    it('TC-S058: Bảo toàn các mốc thời gian createdAt, updatedAt kiểu Date', async () => {
      const mockRepo = new MockRoomsRepository();
      const createdAt = new Date('2026-03-01T00:00:00Z');
      const updatedAt = new Date('2026-03-02T00:00:00Z');
      mockRepo.findActiveBySlugResult = createSampleRoom({ createdAt, updatedAt });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-vr');
      assert.deepStrictEqual(res.createdAt, createdAt);
      assert.deepStrictEqual(res.updatedAt, updatedAt);
    });

    it('TC-S059: Ném lại ngoại lệ khi roomsRepo.findActiveBySlug ném lỗi DB', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugError = new Error('Database read failure');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.getPublicBySlug('phong-vr');
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Database read failure');
          return true;
        },
      );
    });

    it('TC-S060: Không lộ các thuộc tính nội bộ ngoài RoomResponse', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findActiveBySlugResult = createSampleRoom();
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('phong-kham-pha');
      const item = res as unknown as Record<string, unknown>;
      assert.strictEqual(item.isDeleted, undefined);
      assert.strictEqual(item.deletedAt, undefined);
      assert.strictEqual(item.exhibits, undefined);
    });
  });

  // =========================================================================
  // SUITE 5: create(dto: CreateRoomDto) (15 Test Cases: TC-S061 -> TC-S075)
  // =========================================================================
  describe('Suite 5: create (15 Test Cases)', () => {
    it('TC-S061: Tạo phòng mới thành công khi slug chưa tồn tại', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);
      const dto: CreateRoomDto = {
        slug: 'phong-moi',
        name: 'Phòng Mới',
        description: 'Mô tả phòng mới',
      };

      const res = await service.create(dto);
      assert.strictEqual(res.slug, 'phong-moi');
      assert.strictEqual(res.name, 'Phòng Mới');
      assert.strictEqual(res.description, 'Mô tả phòng mới');
    });

    it('TC-S062: Gọi roomsRepo.findBySlug để kiểm tra tính duy nhất của slug trước khi tạo', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.create({ slug: 'kiem-tra-slug', name: 'Kiểm Tra Slug' });
      assert.strictEqual(mockRepo.findBySlugCalls.length, 1);
      assert.strictEqual(mockRepo.findBySlugCalls[0], 'kiem-tra-slug');
    });

    it('TC-S063: Ném ConflictException khi slug đã được sử dụng', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = createSampleRoom({ slug: 'slug-trung' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.create({ slug: 'slug-trung', name: 'Phòng Bị Trùng' });
        },
        (err: unknown) => {
          assert(err instanceof ConflictException);
          return true;
        },
      );
    });

    it('TC-S064: Thông báo lỗi ConflictException chứa slug trùng: Slug "..." đã được sử dụng', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = createSampleRoom({ slug: 'slug-trung' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.create({ slug: 'slug-trung', name: 'Phòng Bị Trùng' });
        },
        (err: ConflictException) => {
          assert.strictEqual(err.message, 'Slug "slug-trung" đã được sử dụng');
          return true;
        },
      );
    });

    it('TC-S065: Ngoại lệ trùng slug có HTTP status 409', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = createSampleRoom({ slug: 'slug-trung' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.create({ slug: 'slug-trung', name: 'Phòng Bị Trùng' });
        },
        (err: ConflictException) => {
          assert.strictEqual(err.getStatus(), 409);
          return true;
        },
      );
    });

    it('TC-S066: Gọi roomsRepo.create với đúng thuộc tính { slug, name, description }', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);
      const dto: CreateRoomDto = {
        slug: 'phong-hoi-hoa',
        name: 'Phòng Hội Họa',
        description: 'Tranh sơn dầu và sơn mài',
      };

      await service.create(dto);
      assert.strictEqual(mockRepo.createCalls.length, 1);
      assert.deepStrictEqual(mockRepo.createCalls[0], {
        slug: 'phong-hoi-hoa',
        name: 'Phòng Hội Họa',
        description: 'Tranh sơn dầu và sơn mài',
      });
    });

    it('TC-S067: Gán description = null khi DTO không cung cấp description (undefined)', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);
      const dto: CreateRoomDto = {
        slug: 'phong-khong-mo-ta',
        name: 'Phòng Không Mô Tả',
      };

      await service.create(dto);
      assert.strictEqual(mockRepo.createCalls[0].description, null);
    });

    it('TC-S068: Gán description theo chuỗi khi DTO cung cấp mô tả hợp lệ', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.create({
        slug: 'phong-co-mo-ta',
        name: 'Phòng Có Mô Tả',
        description: 'Mô tả rõ ràng',
      });
      assert.strictEqual(mockRepo.createCalls[0].description, 'Mô tả rõ ràng');
    });

    it('TC-S069: Gọi roomsRepo.save để lưu entity đã tạo', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.create({ slug: 'phong-luu', name: 'Phòng Lưu' });
      assert.strictEqual(mockRepo.saveCalls.length, 1);
    });

    it('TC-S070: Trả về RoomResponse từ entity đã lưu thành công', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const savedEntity = createSampleRoom({ id: 'saved-id', slug: 'phong-moi', name: 'Phòng Mới' });
      mockRepo.saveResult = savedEntity;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.create({ slug: 'phong-moi', name: 'Phòng Mới' });
      assert.strictEqual(res.id, 'saved-id');
      assert.strictEqual(res.slug, 'phong-moi');
      assert.strictEqual(res.name, 'Phòng Mới');
    });

    it('TC-S071: Kết quả trả về có exhibitsCount = 0 vì phòng mới chưa có hiện vật', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.create({ slug: 'phong-moi', name: 'Phòng Mới' });
      assert.strictEqual(res.exhibitsCount, 0);
    });

    it('TC-S072: Không gọi roomsRepo.create hay roomsRepo.save nếu kiểm tra slug bị trùng', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = createSampleRoom({ slug: 'trung' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      try {
        await service.create({ slug: 'trung', name: 'Phòng' });
      } catch {
        // Expected conflict
      }
      assert.strictEqual(mockRepo.createCalls.length, 0);
      assert.strictEqual(mockRepo.saveCalls.length, 0);
    });

    it('TC-S073: Chuyển tiếp ngoại lệ khi roomsRepo.findBySlug ném lỗi', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugError = new Error('Slug check DB error');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.create({ slug: 'phong', name: 'Phòng' });
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Slug check DB error');
          return true;
        },
      );
    });

    it('TC-S074: Chuyển tiếp ngoại lệ khi roomsRepo.save ném lỗi', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      mockRepo.saveError = new Error('Save room DB error');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.create({ slug: 'phong', name: 'Phòng' });
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Save room DB error');
          return true;
        },
      );
    });

    it('TC-S075: Tạo phòng thành công với các slug đặc biệt (có số, nhiều đoạn gạch ngang)', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findBySlugResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.create({
        slug: 'tang-2-phong-3d-so-1',
        name: 'Tầng 2 - Phòng 3D Số 1',
      });
      assert.strictEqual(res.slug, 'tang-2-phong-3d-so-1');
    });
  });

  // =========================================================================
  // SUITE 6: update(id: string, dto: UpdateRoomDto) (15 Test Cases: TC-S076 -> TC-S090)
  // =========================================================================
  describe('Suite 6: update (15 Test Cases)', () => {
    it('TC-S076: Cập nhật phòng thành công khi ID hợp lệ và phòng tồn tại', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ id: 'room-076', name: 'Tên Cũ' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.update('room-076', { name: 'Tên Mới' });
      assert.strictEqual(res.name, 'Tên Mới');
      assert.strictEqual(existing.name, 'Tên Mới');
    });

    it('TC-S077: Gọi roomsRepo.findWithExhibits(id) để tìm phòng trước khi cập nhật', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ id: 'room-077' });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-077', { name: 'Đổi Tên' });
      assert.strictEqual(mockRepo.findWithExhibitsCalls.length, 1);
      assert.strictEqual(mockRepo.findWithExhibitsCalls[0], 'room-077');
    });

    it('TC-S078: Ném NotFoundException khi phòng cần cập nhật không tồn tại', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.update('missing-id', { name: 'Đổi Tên' });
        },
        (err: unknown) => {
          assert(err instanceof NotFoundException);
          return true;
        },
      );
    });

    it('TC-S079: Thông điệp ngoại lệ là "Không tìm thấy phòng trưng bày" khi phòng không tồn tại', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.update('missing-id', { name: 'Đổi Tên' });
        },
        (err: NotFoundException) => {
          assert.strictEqual(err.message, 'Không tìm thấy phòng trưng bày');
          return true;
        },
      );
    });

    it('TC-S080: Cập nhật trường name khi dto.name được cung cấp', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ name: 'Tên Ban Đầu' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-id', { name: 'Tên Đã Sửa' });
      assert.strictEqual(existing.name, 'Tên Đã Sửa');
    });

    it('TC-S081: Giữ nguyên trường name cũ khi dto.name là undefined', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ name: 'Tên Ban Đầu' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-id', { description: 'Chỉ cập nhật mô tả' });
      assert.strictEqual(existing.name, 'Tên Ban Đầu');
    });

    it('TC-S082: Cập nhật trường description thành chuỗi mới khi dto.description có giá trị', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ description: 'Mô tả cũ' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-id', { description: 'Mô tả mới toanh' });
      assert.strictEqual(existing.description, 'Mô tả mới toanh');
    });

    it('TC-S083: Cập nhật trường description thành chuỗi rỗng khi dto.description là ""', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ description: 'Mô tả cũ' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-id', { description: '' });
      assert.strictEqual(existing.description, '');
    });

    it('TC-S084: Giữ nguyên trường description cũ khi dto.description là undefined', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ description: 'Mô tả cũ không đổi' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-id', { name: 'Tên Mới' });
      assert.strictEqual(existing.description, 'Mô tả cũ không đổi');
    });

    it('TC-S085: Cập nhật trường status sang ARCHIVED khi dto.status được truyền', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ status: RoomStatus.ACTIVE });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-id', { status: RoomStatus.ARCHIVED });
      assert.strictEqual(existing.status, RoomStatus.ARCHIVED);
    });

    it('TC-S086: Cập nhật trường status sang ACTIVE khi dto.status được truyền', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ status: RoomStatus.ARCHIVED });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-id', { status: RoomStatus.ACTIVE });
      assert.strictEqual(existing.status, RoomStatus.ACTIVE);
    });

    it('TC-S087: Bất biến slug: không cho phép thay đổi slug dù DTO có cố tình chứa', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ slug: 'slug-bat-bien' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      // Cast DTO để kiểm tra tính bất biến nếu có ai đó inject trường slug
      const sneakyDto = { name: 'Tên Mới', slug: 'slug-thay-doi' } as unknown as UpdateRoomDto;
      await service.update('room-id', sneakyDto);
      assert.strictEqual(existing.slug, 'slug-bat-bien');
    });

    it('TC-S088: Gọi roomsRepo.save với entity phòng sau khi đã áp dụng các thay đổi', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ id: 'room-088' });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.update('room-088', { name: 'Tên Cập Nhật' });
      assert.strictEqual(mockRepo.saveCalls.length, 1);
      assert.strictEqual((mockRepo.saveCalls[0] as Room).id, 'room-088');
    });

    it('TC-S089: Trả về RoomResponse phản ánh đúng các giá trị mới đã cập nhật', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({
        id: 'room-089',
        name: 'Tên Cũ',
        status: RoomStatus.ACTIVE,
      });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const res = await service.update('room-089', {
        name: 'Tên Mới Nhất',
        status: RoomStatus.ARCHIVED,
      });
      assert.strictEqual(res.name, 'Tên Mới Nhất');
      assert.strictEqual(res.status, RoomStatus.ARCHIVED);
    });

    it('TC-S090: Chuyển tiếp ngoại lệ khi roomsRepo.save ném lỗi', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom();
      mockRepo.saveError = new Error('Save update failed');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.update('room-id', { name: 'Lỗi' });
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Save update failed');
          return true;
        },
      );
    });
  });

  // =========================================================================
  // SUITE 7: remove(id: string) & Ràng buộc BR-20 (15 Test Cases: TC-S091 -> TC-S105)
  // =========================================================================
  describe('Suite 7: remove & BR-20 Soft Delete (15 Test Cases)', () => {
    it('TC-S091: Xóa mềm phòng thành công khi phòng tồn tại và không chứa hiện vật (exhibits: [])', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ exhibits: [] });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.remove('room-id');
      assert.strictEqual(existing.isDeleted, true);
      assert.ok(existing.deletedAt instanceof Date);
    });

    it('TC-S092: Gọi roomsRepo.findWithExhibits(id) để tải phòng cùng quan hệ exhibits', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ exhibits: [] });
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.remove('target-remove-id');
      assert.strictEqual(mockRepo.findWithExhibitsCalls.length, 1);
      assert.strictEqual(mockRepo.findWithExhibitsCalls[0], 'target-remove-id');
    });

    it('TC-S093: Ném NotFoundException khi phòng cần xóa không tồn tại', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.remove('non-existent-room-id');
        },
        (err: unknown) => {
          assert(err instanceof NotFoundException);
          return true;
        },
      );
    });

    it('TC-S094: Thông báo lỗi NotFoundException là "Không tìm thấy phòng trưng bày"', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = null;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.remove('non-existent-room-id');
        },
        (err: NotFoundException) => {
          assert.strictEqual(err.message, 'Không tìm thấy phòng trưng bày');
          return true;
        },
      );
    });

    it('TC-S095: Quy tắc BR-20: Ném ConflictException khi phòng đang chứa 1 hiện vật', async () => {
      const mockRepo = new MockRoomsRepository();
      const ex1 = createSampleExhibit();
      const existing = createSampleRoom({ exhibits: [ex1] });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.remove('room-with-1-exhibit');
        },
        (err: unknown) => {
          assert(err instanceof ConflictException);
          return true;
        },
      );
    });

    it('TC-S096: Quy tắc BR-20: Ném ConflictException khi phòng đang chứa nhiều hiện vật (3 hiện vật)', async () => {
      const mockRepo = new MockRoomsRepository();
      const ex1 = createSampleExhibit({ id: 'ex-1' });
      const ex2 = createSampleExhibit({ id: 'ex-2' });
      const ex3 = createSampleExhibit({ id: 'ex-3' });
      const existing = createSampleRoom({ exhibits: [ex1, ex2, ex3] });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.remove('room-with-many-exhibits');
        },
        (err: unknown) => {
          assert(err instanceof ConflictException);
          return true;
        },
      );
    });

    it('TC-S097: Thông báo lỗi ConflictException giải thích rõ ràng theo BR-20', async () => {
      const mockRepo = new MockRoomsRepository();
      const ex1 = createSampleExhibit();
      const existing = createSampleRoom({ exhibits: [ex1] });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.remove('room-with-exhibit');
        },
        (err: ConflictException) => {
          assert.strictEqual(
            err.message,
            'Không thể xóa phòng đang chứa hiện vật. Vui lòng chuyển hoặc gỡ hiện vật trước khi xóa phòng.',
          );
          assert.strictEqual(err.getStatus(), 409);
          return true;
        },
      );
    });

    it('TC-S098: Xóa mềm thành công khi trường exhibits là null hoặc undefined', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom();
      (existing as unknown as Record<string, unknown>).exhibits = null;
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.remove('room-no-exhibits-property');
      assert.strictEqual(existing.isDeleted, true);
      assert.ok(existing.deletedAt instanceof Date);
    });

    it('TC-S099: Khi xóa mềm thành công, đặt room.isDeleted = true', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ exhibits: [], isDeleted: false });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.remove('room-id');
      assert.strictEqual(existing.isDeleted, true);
    });

    it('TC-S100: Khi xóa mềm thành công, gán room.deletedAt là một đối tượng Date hiện tại', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ exhibits: [], deletedAt: null });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      const before = new Date();
      await service.remove('room-id');
      const after = new Date();

      assert.ok(existing.deletedAt instanceof Date);
      assert.ok(existing.deletedAt.getTime() >= before.getTime());
      assert.ok(existing.deletedAt.getTime() <= after.getTime());
    });

    it('TC-S101: Gọi roomsRepo.save để lưu trạng thái xóa mềm của phòng', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ exhibits: [] });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.remove('room-id');
      assert.strictEqual(mockRepo.saveCalls.length, 1);
      assert.strictEqual((mockRepo.saveCalls[0] as Room).isDeleted, true);
    });

    it('TC-S102: Không bao giờ gọi roomsRepo.save khi vi phạm quy tắc BR-20', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ exhibits: [createSampleExhibit()] });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      try {
        await service.remove('room-with-exhibit');
      } catch {
        // Expected conflict
      }
      assert.strictEqual(mockRepo.saveCalls.length, 0);
    });

    it('TC-S103: Không xóa vật lý bản ghi khỏi database (chỉ đánh dấu isDeleted = true)', async () => {
      const mockRepo = new MockRoomsRepository();
      const existing = createSampleRoom({ exhibits: [] });
      mockRepo.findWithExhibitsResult = existing;
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await service.remove('room-id');
      assert.strictEqual(existing.isDeleted, true);
      assert.notStrictEqual(existing.deletedAt, null);
    });

    it('TC-S104: Chuyển tiếp ngoại lệ khi roomsRepo.findWithExhibits ném lỗi', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsError = new Error('Find with exhibits failed');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.remove('room-id');
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Find with exhibits failed');
          return true;
        },
      );
    });

    it('TC-S105: Chuyển tiếp ngoại lệ khi roomsRepo.save ném lỗi trong quá trình xóa mềm', async () => {
      const mockRepo = new MockRoomsRepository();
      mockRepo.findWithExhibitsResult = createSampleRoom({ exhibits: [] });
      mockRepo.saveError = new Error('Save soft delete failed');
      const service = new RoomsService(mockRepo as unknown as RoomsRepository);

      await assert.rejects(
        async () => {
          await service.remove('room-id');
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Save soft delete failed');
          return true;
        },
      );
    });
  });
});
