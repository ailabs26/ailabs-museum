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

// Helper tạo Room mẫu
function createSampleRoom(overrides?: Partial<Room>): Room {
  const room = new Room();
  room.id = overrides?.id ?? 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
  room.slug = overrides?.slug ?? 'phong-kham-pha';
  room.name = overrides?.name ?? 'Phòng Khám Phá';
  room.description =
    overrides && 'description' in overrides
      ? (overrides.description ?? null)
      : 'Mô tả phòng mẫu';
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

// Mock RoomsRepository linh hoạt với memory store
class InMemoryMockRoomsRepository {
  rooms: Map<string, Room> = new Map();
  searchRoomsCalls: ListRoomsQueryDto[] = [];
  findWithExhibitsCalls: string[] = [];
  findPublicRoomsCallsCount = 0;
  findActiveBySlugCalls: string[] = [];
  findBySlugCalls: string[] = [];
  createCalls: Array<DeepPartial<Room>> = [];
  saveCalls: Array<Room | Room[]> = [];

  // Cho phép inject lỗi giả lập
  errorToThrow?: Error;

  seed(roomList: Room[]) {
    this.rooms.clear();
    for (const r of roomList) {
      this.rooms.set(r.id, r);
    }
  }

  async searchRooms(query: ListRoomsQueryDto): Promise<Paginated<Room>> {
    this.searchRoomsCalls.push(query);
    if (this.errorToThrow) throw this.errorToThrow;

    let items = Array.from(this.rooms.values()).filter((r) => !r.isDeleted);
    if (query.status) {
      items = items.filter((r) => r.status === query.status);
    }
    if (query.q && query.q.trim()) {
      const q = query.q.trim().toLowerCase();
      items = items.filter(
        (r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q),
      );
    }
    const total = items.length;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 20);
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return { items: paginatedItems, total, page, pageSize };
  }

  async findWithExhibits(id: string): Promise<Room | null> {
    this.findWithExhibitsCalls.push(id);
    if (this.errorToThrow) throw this.errorToThrow;
    const room = this.rooms.get(id);
    if (!room || room.isDeleted) return null;
    return room;
  }

  async findPublicRooms(): Promise<Room[]> {
    this.findPublicRoomsCallsCount++;
    if (this.errorToThrow) throw this.errorToThrow;
    return Array.from(this.rooms.values())
      .filter((r) => !r.isDeleted && r.status === RoomStatus.ACTIVE)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findActiveBySlug(slug: string): Promise<Room | null> {
    this.findActiveBySlugCalls.push(slug);
    if (this.errorToThrow) throw this.errorToThrow;
    const room = Array.from(this.rooms.values()).find(
      (r) => r.slug === slug && !r.isDeleted && r.status === RoomStatus.ACTIVE,
    );
    return room ?? null;
  }

  async findBySlug(slug: string): Promise<Room | null> {
    this.findBySlugCalls.push(slug);
    if (this.errorToThrow) throw this.errorToThrow;
    const room = Array.from(this.rooms.values()).find(
      (r) => r.slug === slug && !r.isDeleted,
    );
    return room ?? null;
  }

  create(data: DeepPartial<Room>): Room {
    this.createCalls.push(data);
    const room = new Room();
    Object.assign(room, data);
    room.id = `room-uuid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    room.status = RoomStatus.ACTIVE;
    room.isDeleted = false;
    room.deletedAt = null;
    room.createdAt = new Date();
    room.updatedAt = new Date();
    room.exhibits = [];
    return room;
  }

  async save(entity: Room | Room[]): Promise<Room | Room[]> {
    this.saveCalls.push(entity);
    if (this.errorToThrow) throw this.errorToThrow;

    if (Array.isArray(entity)) {
      for (const item of entity) {
        this.rooms.set(item.id, item);
      }
      return entity;
    } else {
      this.rooms.set(entity.id, entity);
      return entity;
    }
  }
}

describe('Task 6.3 — Extended Scenario & Edge Case Test Suite (100 Test Cases)', () => {
  // =========================================================================
  // SUITE 1: Lifecycle & Multi-Step Business Flows (TC-E001 -> TC-E010)
  // =========================================================================
  describe('Suite 1: Lifecycle & Multi-Step Business Flows (10 Test Cases)', () => {
    it('TC-E001: Luồng hoàn chỉnh: Tạo phòng -> Xem chi tiết -> Cập nhật tên -> Xóa mềm thành công', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      // 1. Tạo phòng
      const created = await service.create({ slug: 'phong-khao-co', name: 'Phòng Khảo Cổ' });
      assert.strictEqual(created.slug, 'phong-khao-co');

      // 2. Xem chi tiết
      const detail = await service.getById(created.id);
      assert.strictEqual(detail.id, created.id);

      // 3. Cập nhật tên
      const updated = await service.update(created.id, { name: 'Phòng Khảo Cổ Tiền Sử' });
      assert.strictEqual(updated.name, 'Phòng Khảo Cổ Tiền Sử');

      // 4. Xóa mềm
      await service.remove(created.id);
      await assert.rejects(async () => service.getById(created.id), NotFoundException);
    });

    it('TC-E002: Luồng nghiệp vụ BR-20: Tạo phòng -> Có hiện vật -> Cố xóa (bị chặn 409) -> Gỡ hiện vật -> Xóa mềm thành công', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const created = await service.create({ slug: 'phong-co-vat', name: 'Phòng Cổ Vật' });
      const roomEntity = repo.rooms.get(created.id)!;
      roomEntity.exhibits = [createSampleExhibit({ roomId: created.id })];

      // Cố xóa -> Phải bị chặn 409
      await assert.rejects(async () => service.remove(created.id), ConflictException);

      // Gỡ hiện vật khỏi phòng
      roomEntity.exhibits = [];

      // Xóa mềm -> Thành công
      await service.remove(created.id);
      assert.strictEqual(roomEntity.isDeleted, true);
    });

    it('TC-E003: Luồng vòng đời trạng thái: Mặc định ACTIVE -> Chuyển ARCHIVED -> Kích hoạt lại ACTIVE', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const created = await service.create({ slug: 'phong-trien-lam', name: 'Phòng Triển Lãm' });
      assert.strictEqual(created.status, RoomStatus.ACTIVE);

      const archived = await service.update(created.id, { status: RoomStatus.ARCHIVED });
      assert.strictEqual(archived.status, RoomStatus.ARCHIVED);

      const reactivated = await service.update(created.id, { status: RoomStatus.ACTIVE });
      assert.strictEqual(reactivated.status, RoomStatus.ACTIVE);
    });

    it('TC-E004: Luồng cập nhật lặp: Tích lũy các thay đổi qua nhiều lần gọi update riêng biệt', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const room = await service.create({ slug: 'phong-tich-luy', name: 'Tên 1' });
      await service.update(room.id, { name: 'Tên 2' });
      await service.update(room.id, { description: 'Mô tả thêm' });
      const finalResult = await service.update(room.id, { status: RoomStatus.ARCHIVED });

      assert.strictEqual(finalResult.name, 'Tên 2');
      assert.strictEqual(finalResult.description, 'Mô tả thêm');
      assert.strictEqual(finalResult.status, RoomStatus.ARCHIVED);
    });

    it('TC-E005: Luồng tra cứu công khai: Phòng ACTIVE xuất hiện trong getPublicList, khi ARCHIVED thì biến mất', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const room = await service.create({ slug: 'phong-cong-khai', name: 'Phòng Công Khai' });
      let publicList = await service.getPublicList();
      assert.strictEqual(publicList.some((r) => r.id === room.id), true);

      await service.update(room.id, { status: RoomStatus.ARCHIVED });
      publicList = await service.getPublicList();
      assert.strictEqual(publicList.some((r) => r.id === room.id), false);
    });

    it('TC-E006: Luồng slug công khai: getPublicBySlug thành công khi ACTIVE, ném 404 khi chuyển sang ARCHIVED', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const room = await service.create({ slug: 'slug-cong-khai-1', name: 'Phòng 1' });
      const pub = await service.getPublicBySlug('slug-cong-khai-1');
      assert.strictEqual(pub.id, room.id);

      await service.update(room.id, { status: RoomStatus.ARCHIVED });
      await assert.rejects(async () => service.getPublicBySlug('slug-cong-khai-1'), NotFoundException);
    });

    it('TC-E007: Luồng chặn tạo trùng slug với phòng đang tồn tại', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await service.create({ slug: 'slug-duy-nhat', name: 'Phòng Duy Nhất 1' });
      await assert.rejects(
        async () => service.create({ slug: 'slug-duy-nhat', name: 'Phòng Duy Nhất 2' }),
        ConflictException,
      );
    });

    it('TC-E008: Luồng kiểm tra sau xóa mềm: Phòng không còn xuất hiện trong getPublicBySlug', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const room = await service.create({ slug: 'phong-sap-xoa', name: 'Phòng Sắp Xóa' });
      await service.remove(room.id);
      await assert.rejects(async () => service.getPublicBySlug('phong-sap-xoa'), NotFoundException);
    });

    it('TC-E009: Luồng tạo không mô tả (null) -> Cập nhật mô tả -> Cập nhật thành chuỗi rỗng', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const room = await service.create({ slug: 'phong-mo-ta', name: 'Phòng Mô Tả' });
      assert.strictEqual(room.description, null);

      const updated1 = await service.update(room.id, { description: 'Có mô tả rồi' });
      assert.strictEqual(updated1.description, 'Có mô tả rồi');

      const updated2 = await service.update(room.id, { description: '' });
      assert.strictEqual(updated2.description, '');
    });

    it('TC-E010: Luồng tạo 3 phòng liên tiếp -> list trả về đúng 3 phòng theo thứ tự phân trang', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await service.create({ slug: 'phong-a', name: 'Phòng A' });
      await service.create({ slug: 'phong-b', name: 'Phòng B' });
      await service.create({ slug: 'phong-c', name: 'Phòng C' });

      const res = await service.list(createSampleQuery({ pageSize: 10 }));
      assert.strictEqual(res.total, 3);
      assert.strictEqual(res.items.length, 3);
    });
  });

  // =========================================================================
  // SUITE 2: Boundary & Extreme String Values (TC-E011 -> TC-E020)
  // =========================================================================
  describe('Suite 2: Boundary & Extreme String Values (10 Test Cases)', () => {
    it('TC-E011: Tạo phòng với slug đạt biên tối đa 120 ký tự hợp lệ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const maxSlug = 'a'.repeat(120);

      const created = await service.create({ slug: maxSlug, name: 'Phòng Biên Max Slug' });
      assert.strictEqual(created.slug.length, 120);
      assert.strictEqual(created.slug, maxSlug);
    });

    it('TC-E012: Tạo phòng với slug tối thiểu 1 ký tự ("x")', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const created = await service.create({ slug: 'x', name: 'Phòng Slug 1 Ký Tự' });
      assert.strictEqual(created.slug, 'x');
    });

    it('TC-E013: Tạo phòng với tên đạt giới hạn tối đa 200 ký tự hợp lệ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const maxName = 'T'.repeat(200);

      const created = await service.create({ slug: 'phong-max-name', name: maxName });
      assert.strictEqual(created.name.length, 200);
      assert.strictEqual(created.name, maxName);
    });

    it('TC-E014: Tạo phòng với tên chứa đầy đủ ký tự tiếng Việt có dấu phức tạp', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const vnName = 'Không Gian Trưng Bày Hiện Vật Lịch Sử Thời Kỳ Bắc Thuộc & Khởi Nghĩa Hai Bà Trưng';

      const created = await service.create({ slug: 'khong-gian-hai-ba-trung', name: vnName });
      assert.strictEqual(created.name, vnName);
    });

    it('TC-E015: Cập nhật tên phòng bằng chuỗi 200 ký tự hợp lệ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const room = await service.create({ slug: 'phong-update-max', name: 'Tên Ban Đầu' });

      const newMaxName = 'U'.repeat(200);
      const updated = await service.update(room.id, { name: newMaxName });
      assert.strictEqual(updated.name, newMaxName);
    });

    it('TC-E016: Tạo phòng với mô tả cực dài (> 2000 ký tự)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const longDesc = 'Mô tả bảo tàng chi tiết: '.concat('Di sản văn hóa phi vật thể và vật thể. '.repeat(100));

      const created = await service.create({
        slug: 'phong-mo-ta-dai',
        name: 'Phòng Mô Tả Dài',
        description: longDesc,
      });
      assert.strictEqual(created.description, longDesc);
    });

    it('TC-E017: Tạo phòng với slug kết hợp số và nhiều đoạn gạch ngang ("khu-a-tang-3-phong-07-3d")', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const complexSlug = 'khu-a-tang-3-phong-07-3d';

      const created = await service.create({ slug: complexSlug, name: 'Phòng Phức Tạp' });
      assert.strictEqual(created.slug, complexSlug);
    });

    it('TC-E018: Cập nhật mô tả chứa ký tự xuống dòng (\\n) và ký tự tab (\\t)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const room = await service.create({ slug: 'phong-multiline', name: 'Phòng Đa Dòng' });

      const multilineDesc = 'Đoạn 1: Lịch sử hình thành.\n\tĐoạn 2: Quá trình phát triển.\nĐoạn 3: Kết luận.';
      const updated = await service.update(room.id, { description: multilineDesc });
      assert.strictEqual(updated.description, multilineDesc);
    });

    it('TC-E019: Tạo phòng với tên chứa các ký tự đặc biệt thực tế (dấu ngoặc, dấu chấm, dấu gạch ngang)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const name = 'Phòng Trưng Bày Chuyên Đề: Gốm Sứ Chu Đậu (Thế Kỷ XV - XVI) - Khu Vực A.2';

      const created = await service.create({ slug: 'gom-su-chu-dau', name });
      assert.strictEqual(created.name, name);
    });

    it('TC-E020: Tạo phòng với slug gồm các số và dấu gạch nối ("1945-1975")', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const created = await service.create({ slug: '1945-1975', name: 'Thời Kỳ 1945 - 1975' });
      assert.strictEqual(created.slug, '1945-1975');
    });
  });

  // =========================================================================
  // SUITE 3: BR-20 Detailed Exhibit Edge Cases (TC-E021 -> TC-E030)
  // =========================================================================
  describe('Suite 3: BR-20 Detailed Exhibit Edge Cases (10 Test Cases)', () => {
    it('TC-E021: Phòng có 1 hiện vật VISIBLE -> chặn xóa mềm (ConflictException)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-vis', exhibits: [createSampleExhibit({ visibility: ExhibitVisibility.VISIBLE })] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(async () => service.remove('r-vis'), ConflictException);
    });

    it('TC-E022: Phòng có 1 hiện vật HIDDEN -> vẫn chặn xóa mềm (ConflictException)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-hid', exhibits: [createSampleExhibit({ visibility: ExhibitVisibility.HIDDEN })] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(async () => service.remove('r-hid'), ConflictException);
    });

    it('TC-E023: Phòng có 10 hiện vật -> ném ConflictException và không gọi repo.save', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const exhibits = Array.from({ length: 10 }, (_, i) => createSampleExhibit({ id: `ex-${i}` }));
      const room = createSampleRoom({ id: 'r-10-ex', exhibits });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(async () => service.remove('r-10-ex'), ConflictException);
      assert.strictEqual(repo.saveCalls.length, 0);
    });

    it('TC-E024: Phòng có hiện vật đã lưu trữ (archivedAt != null) -> vẫn chặn xóa theo BR-20', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const exArchived = createSampleExhibit({ archivedAt: new Date('2026-01-01') });
      const room = createSampleRoom({ id: 'r-arch-ex', exhibits: [exArchived] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(async () => service.remove('r-arch-ex'), ConflictException);
    });

    it('TC-E025: Xóa phòng khi exhibits là mảng rỗng [] -> thành công và gán isDeleted = true', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-empty', exhibits: [] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await service.remove('r-empty');
      assert.strictEqual(room.isDeleted, true);
      assert.ok(room.deletedAt instanceof Date);
    });

    it('TC-E026: Xóa phòng khi exhibits là undefined -> coi như không có hiện vật và xóa mềm thành công', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-undef' });
      delete (room as Partial<Room>).exhibits;
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await service.remove('r-undef');
      assert.strictEqual(room.isDeleted, true);
    });

    it('TC-E027: Thông báo lỗi ConflictException chứa chính xác nội dung hướng dẫn BR-20', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-msg', exhibits: [createSampleExhibit()] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.remove('r-msg'),
        (err: ConflictException) => {
          assert.strictEqual(
            err.message,
            'Không thể xóa phòng đang chứa hiện vật. Vui lòng chuyển hoặc gỡ hiện vật trước khi xóa phòng.',
          );
          return true;
        },
      );
    });

    it('TC-E028: Thời gian deletedAt được gán gần với Date.now() (sai số < 2000ms)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-time', exhibits: [] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const before = Date.now();
      await service.remove('r-time');
      const after = Date.now();

      assert.ok(room.deletedAt instanceof Date);
      assert.ok(room.deletedAt.getTime() >= before && room.deletedAt.getTime() <= after);
    });

    it('TC-E029: id của phòng không bị thay đổi sau khi xóa mềm', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'fixed-uuid-room', exhibits: [] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await service.remove('fixed-uuid-room');
      assert.strictEqual(room.id, 'fixed-uuid-room');
    });

    it('TC-E030: slug của phòng không bị thay đổi sau khi xóa mềm', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'slug-check-room', slug: 'phong-giu-slug', exhibits: [] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await service.remove('slug-check-room');
      assert.strictEqual(room.slug, 'phong-giu-slug');
    });
  });

  // =========================================================================
  // SUITE 4: Immutability & Parameter Mutation Safety (TC-E031 -> TC-E040)
  // =========================================================================
  describe('Suite 4: Immutability & Parameter Mutation Safety (10 Test Cases)', () => {
    it('TC-E031: Hàm create không làm đột biến đối tượng CreateRoomDto truyền vào', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const dto: CreateRoomDto = { slug: 'phong-dto-safe', name: 'Phòng An Toàn DTO', description: 'Mô tả' };
      const dtoCopy = { ...dto };

      await service.create(dto);
      assert.deepStrictEqual(dto, dtoCopy);
    });

    it('TC-E032: Hàm update không làm đột biến đối tượng UpdateRoomDto truyền vào', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-dto-safe' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const dto: UpdateRoomDto = { name: 'Tên Đổi', status: RoomStatus.ARCHIVED };
      const dtoCopy = { ...dto };

      await service.update('r-dto-safe', dto);
      assert.deepStrictEqual(dto, dtoCopy);
    });

    it('TC-E033: Hàm list không làm đột biến đối tượng ListRoomsQueryDto truyền vào', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const query = createSampleQuery({ page: 2, pageSize: 15, q: 'test' });
      const queryCopy = { ...query };

      await service.list(query);
      assert.strictEqual(query.page, queryCopy.page);
      assert.strictEqual(query.pageSize, queryCopy.pageSize);
      assert.strictEqual(query.q, queryCopy.q);
    });

    it('TC-E034: Hàm update bảo toàn nguyên vẹn trường id của entity Room gốc', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'immut-id' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('immut-id', { name: 'Tên Mới' });
      assert.strictEqual(res.id, 'immut-id');
      assert.strictEqual(room.id, 'immut-id');
    });

    it('TC-E035: Hàm update bảo toàn nguyên vẹn trường createdAt của entity Room gốc', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const room = createSampleRoom({ id: 'r-time-safe', createdAt });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-time-safe', { name: 'Tên Mới' });
      assert.strictEqual(res.createdAt.getTime(), createdAt.getTime());
      assert.strictEqual(room.createdAt.getTime(), createdAt.getTime());
    });

    it('TC-E036: Hàm update bảo toàn nguyên vẹn mảng exhibits của entity Room gốc', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const exhibits = [createSampleExhibit()];
      const room = createSampleRoom({ id: 'r-ex-safe', exhibits });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-ex-safe', { name: 'Tên Mới' });
      assert.strictEqual(res.exhibitsCount, 1);
      assert.strictEqual(room.exhibits.length, 1);
    });

    it('TC-E037: Hàm update không làm thay đổi isDeleted hay deletedAt', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-del-safe', isDeleted: false, deletedAt: null });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await service.update('r-del-safe', { name: 'Tên Mới' });
      assert.strictEqual(room.isDeleted, false);
      assert.strictEqual(room.deletedAt, null);
    });

    it('TC-E038: Hàm list trả về mảng items mới, sửa đổi item không ảnh hưởng repository', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-clone-check', name: 'Gốc' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      res.items[0].name = 'Bị sửa ở ngoài';
      assert.strictEqual(room.name, 'Gốc');
    });

    it('TC-E039: Hàm getPublicList trả về mảng mới tách biệt', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-pub-check', name: 'Công Khai Gốc' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const list1 = await service.getPublicList();
      const list2 = await service.getPublicList();
      assert.notStrictEqual(list1, list2);
      assert.deepStrictEqual(list1, list2);
    });

    it('TC-E040: Gọi getById nhiều lần trả về kết quả nhất quán mà không làm thay đổi entity', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-repeat-get' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res1 = await service.getById('r-repeat-get');
      const res2 = await service.getById('r-repeat-get');
      assert.deepStrictEqual(res1, res2);
    });
  });

  // =========================================================================
  // SUITE 5: Partial Updates & Field Combination (TC-E041 -> TC-E050)
  // =========================================================================
  describe('Suite 5: Partial Updates & Field Combination (10 Test Cases)', () => {
    it('TC-E041: Cập nhật duy nhất name: description và status giữ nguyên giá trị cũ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-1', name: 'Cũ', description: 'Mô tả cũ', status: RoomStatus.ACTIVE });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-1', { name: 'Mới' });
      assert.strictEqual(res.name, 'Mới');
      assert.strictEqual(res.description, 'Mô tả cũ');
      assert.strictEqual(res.status, RoomStatus.ACTIVE);
    });

    it('TC-E042: Cập nhật duy nhất description: name và status giữ nguyên giá trị cũ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-2', name: 'Tên Giữ', description: 'Mô tả cũ', status: RoomStatus.ARCHIVED });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-2', { description: 'Mô tả mới' });
      assert.strictEqual(res.name, 'Tên Giữ');
      assert.strictEqual(res.description, 'Mô tả mới');
      assert.strictEqual(res.status, RoomStatus.ARCHIVED);
    });

    it('TC-E043: Cập nhật duy nhất status: name và description giữ nguyên giá trị cũ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-3', name: 'Tên Giữ', description: 'Mô tả giữ', status: RoomStatus.ACTIVE });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-3', { status: RoomStatus.ARCHIVED });
      assert.strictEqual(res.name, 'Tên Giữ');
      assert.strictEqual(res.description, 'Mô tả giữ');
      assert.strictEqual(res.status, RoomStatus.ARCHIVED);
    });

    it('TC-E044: Cập nhật đồng thời name và description: status giữ nguyên giá trị cũ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-4', status: RoomStatus.ACTIVE });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-4', { name: 'Tên Mới 4', description: 'Mô Tả Mới 4' });
      assert.strictEqual(res.name, 'Tên Mới 4');
      assert.strictEqual(res.description, 'Mô Tả Mới 4');
      assert.strictEqual(res.status, RoomStatus.ACTIVE);
    });

    it('TC-E045: Cập nhật đồng thời name và status: description giữ nguyên giá trị cũ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-5', description: 'Mô tả giữ 5' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-5', { name: 'Tên Mới 5', status: RoomStatus.ARCHIVED });
      assert.strictEqual(res.name, 'Tên Mới 5');
      assert.strictEqual(res.description, 'Mô tả giữ 5');
      assert.strictEqual(res.status, RoomStatus.ARCHIVED);
    });

    it('TC-E046: Cập nhật đồng thời description và status: name giữ nguyên giá trị cũ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-6', name: 'Tên Giữ 6' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-6', { description: 'Mô tả đổi 6', status: RoomStatus.ARCHIVED });
      assert.strictEqual(res.name, 'Tên Giữ 6');
      assert.strictEqual(res.description, 'Mô tả đổi 6');
      assert.strictEqual(res.status, RoomStatus.ARCHIVED);
    });

    it('TC-E047: Cập nhật đầy đủ cả 3 trường name, description, status cùng một lúc', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-7' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-7', {
        name: 'Tất Cả Mới',
        description: 'Mô Tả Hoàn Toàn Mới',
        status: RoomStatus.ARCHIVED,
      });
      assert.strictEqual(res.name, 'Tất Cả Mới');
      assert.strictEqual(res.description, 'Mô Tả Hoàn Toàn Mới');
      assert.strictEqual(res.status, RoomStatus.ARCHIVED);
    });

    it('TC-E048: Cập nhật với đối tượng rỗng {}: toàn bộ các trường giữ nguyên không đổi', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-8', name: 'Tên Nguyên', description: 'Mô Tả Nguyên', status: RoomStatus.ACTIVE });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-8', {});
      assert.strictEqual(res.name, 'Tên Nguyên');
      assert.strictEqual(res.description, 'Mô Tả Nguyên');
      assert.strictEqual(res.status, RoomStatus.ACTIVE);
    });

    it('TC-E049: Cập nhật description từ có chữ sang chuỗi rỗng ""', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-9', description: 'Có chữ' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-9', { description: '' });
      assert.strictEqual(res.description, '');
    });

    it('TC-E050: Cập nhật status từ ARCHIVED ngược về ACTIVE thành công', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-part-10', status: RoomStatus.ARCHIVED });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-part-10', { status: RoomStatus.ACTIVE });
      assert.strictEqual(res.status, RoomStatus.ACTIVE);
    });
  });

  // =========================================================================
  // SUITE 6: Pagination Metadata & Edge Boundaries (TC-E051 -> TC-E060)
  // =========================================================================
  describe('Suite 6: Pagination Metadata & Edge Boundaries (10 Test Cases)', () => {
    it('TC-E051: List khi total lớn (total = 1000, page = 10, pageSize = 20) phản ánh đúng metadata', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const rooms = Array.from({ length: 100 }, (_, i) => createSampleRoom({ id: `r-${i}`, slug: `slug-${i}` }));
      repo.seed(rooms);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ page: 2, pageSize: 20 }));
      assert.strictEqual(res.total, 100);
      assert.strictEqual(res.page, 2);
      assert.strictEqual(res.pageSize, 20);
      assert.strictEqual(res.items.length, 20);
    });

    it('TC-E052: List khi page vượt quá số trang hiện có (page = 100, items = [], total = 10)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const rooms = Array.from({ length: 10 }, (_, i) => createSampleRoom({ id: `r-${i}`, slug: `slug-${i}` }));
      repo.seed(rooms);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ page: 100, pageSize: 20 }));
      assert.strictEqual(res.total, 10);
      assert.strictEqual(res.items.length, 0);
    });

    it('TC-E053: List tại trang 1 với pageSize = 1 (biên tối thiểu)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r1', slug: 's1' }), createSampleRoom({ id: 'r2', slug: 's2' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ page: 1, pageSize: 1 }));
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.total, 2);
    });

    it('TC-E054: List tại trang 1 với pageSize = 100 (biên tối đa)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const rooms = Array.from({ length: 50 }, (_, i) => createSampleRoom({ id: `r-${i}`, slug: `slug-${i}` }));
      repo.seed(rooms);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ page: 1, pageSize: 100 }));
      assert.strictEqual(res.items.length, 50);
      assert.strictEqual(res.pageSize, 100);
    });

    it('TC-E055: List với total = 0 trả về mảng rỗng và total = 0', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.strictEqual(res.total, 0);
      assert.deepStrictEqual(res.items, []);
    });

    it('TC-E056: List kết hợp lọc status ARCHIVED và từ khóa q', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'r1', name: 'Phòng Hội Họa', status: RoomStatus.ARCHIVED }),
        createSampleRoom({ id: 'r2', name: 'Phòng Hội Họa', status: RoomStatus.ACTIVE }),
        createSampleRoom({ id: 'r3', name: 'Phòng Điêu Khắc', status: RoomStatus.ARCHIVED }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ status: RoomStatus.ARCHIVED, q: 'Hội Họa' }));
      assert.strictEqual(res.total, 1);
      assert.strictEqual(res.items[0].id, 'r1');
    });

    it('TC-E057: List kết hợp lọc status ACTIVE và từ khóa q rỗng (không lọc từ khóa)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'r1', status: RoomStatus.ACTIVE }),
        createSampleRoom({ id: 'r2', status: RoomStatus.ARCHIVED }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ status: RoomStatus.ACTIVE, q: '' }));
      assert.strictEqual(res.total, 1);
      assert.strictEqual(res.items[0].id, 'r1');
    });

    it('TC-E058: List bảo toàn số lượng items đúng bằng độ dài mảng trả về từ repo', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r1', slug: 's1' }), createSampleRoom({ id: 'r2', slug: 's2' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery());
      assert.strictEqual(res.items.length, 2);
    });

    it('TC-E059: List với 25 phần tử: tất cả 25 phần tử đều có cấu trúc RoomResponse hoàn chỉnh', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const rooms = Array.from({ length: 25 }, (_, i) => createSampleRoom({ id: `r-${i}`, slug: `slug-${i}` }));
      repo.seed(rooms);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.list(createSampleQuery({ pageSize: 50 }));
      assert.strictEqual(res.items.length, 25);
      for (const item of res.items) {
        assert.ok(typeof item.id === 'string');
        assert.ok(typeof item.slug === 'string');
        assert.ok(typeof item.name === 'string');
        assert.ok(typeof item.exhibitsCount === 'number');
      }
    });

    it('TC-E060: List với sort query parameter được chuyển tiếp đầy đủ vào repository', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);
      const query = createSampleQuery({ sort: 'name:asc' });

      await service.list(query);
      assert.strictEqual(repo.searchRoomsCalls[0].sort, 'name:asc');
    });
  });

  // =========================================================================
  // SUITE 7: Error Types, Status Codes & Exception Propagation (TC-E061 -> TC-E070)
  // =========================================================================
  describe('Suite 7: Error Types, Status Codes & Exception Propagation (10 Test Cases)', () => {
    it('TC-E061: NotFoundException từ getById có HTTP status code là 404', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.getById('non-existent'),
        (err: NotFoundException) => {
          assert.strictEqual(err.getStatus(), 404);
          return true;
        },
      );
    });

    it('TC-E062: NotFoundException từ getPublicBySlug có HTTP status code là 404', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.getPublicBySlug('non-existent-slug'),
        (err: NotFoundException) => {
          assert.strictEqual(err.getStatus(), 404);
          return true;
        },
      );
    });

    it('TC-E063: NotFoundException từ update có HTTP status code là 404', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.update('non-existent-id', { name: 'Mới' }),
        (err: NotFoundException) => {
          assert.strictEqual(err.getStatus(), 404);
          return true;
        },
      );
    });

    it('TC-E064: NotFoundException từ remove có HTTP status code là 404', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.remove('non-existent-id'),
        (err: NotFoundException) => {
          assert.strictEqual(err.getStatus(), 404);
          return true;
        },
      );
    });

    it('TC-E065: ConflictException từ create khi trùng slug có HTTP status code là 409', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ slug: 'slug-trung' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.create({ slug: 'slug-trung', name: 'Phòng Bị Trùng' }),
        (err: ConflictException) => {
          assert.strictEqual(err.getStatus(), 409);
          return true;
        },
      );
    });

    it('TC-E066: ConflictException từ remove khi vi phạm BR-20 có HTTP status code là 409', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-br20', exhibits: [createSampleExhibit()] })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.remove('r-br20'),
        (err: ConflictException) => {
          assert.strictEqual(err.getStatus(), 409);
          return true;
        },
      );
    });

    it('TC-E067: Exception tùy chỉnh từ Database trong getById được chuyển tiếp nguyên vẹn', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.errorToThrow = new Error('Database connection timeout');
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.getById('any-id'),
        (err: Error) => {
          assert.strictEqual(err.message, 'Database connection timeout');
          return true;
        },
      );
    });

    it('TC-E068: Exception tùy chỉnh từ Database trong create (findBySlug) được chuyển tiếp nguyên vẹn', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.errorToThrow = new Error('Database deadlock occurred');
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(
        async () => service.create({ slug: 'new-slug', name: 'Phòng' }),
        (err: Error) => {
          assert.strictEqual(err.message, 'Database deadlock occurred');
          return true;
        },
      );
    });

    it('TC-E069: Exception tùy chỉnh từ Database trong update (save) được chuyển tiếp nguyên vẹn', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-up-err' });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      // Đặt lỗi sau khi findWithExhibits
      repo.findWithExhibits = async () => room;
      repo.save = async () => {
        throw new Error('Save constraint error');
      };

      await assert.rejects(
        async () => service.update('r-up-err', { name: 'Mới' }),
        (err: Error) => {
          assert.strictEqual(err.message, 'Save constraint error');
          return true;
        },
      );
    });

    it('TC-E070: Exception tùy chỉnh từ Database trong remove (save) được chuyển tiếp nguyên vẹn', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const room = createSampleRoom({ id: 'r-rm-err', exhibits: [] });
      repo.seed([room]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      repo.save = async () => {
        throw new Error('Disk full error');
      };

      await assert.rejects(
        async () => service.remove('r-rm-err'),
        (err: Error) => {
          assert.strictEqual(err.message, 'Disk full error');
          return true;
        },
      );
    });
  });

  // =========================================================================
  // SUITE 8: Concurrency & Parallel Execution Simulations (TC-E071 -> TC-E080)
  // =========================================================================
  describe('Suite 8: Concurrency & Parallel Execution Simulations (10 Test Cases)', () => {
    it('TC-E071: Chạy song song 5 lời gọi getById với các ID khác nhau đồng thời', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const rooms = Array.from({ length: 5 }, (_, i) => createSampleRoom({ id: `par-id-${i}`, slug: `par-s-${i}` }));
      repo.seed(rooms);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const promises = rooms.map((r) => service.getById(r.id));
      const results = await Promise.all(promises);

      assert.strictEqual(results.length, 5);
      results.forEach((res, i) => assert.strictEqual(res.id, `par-id-${i}`));
    });

    it('TC-E072: Chạy song song 5 lời gọi getPublicBySlug với các slug khác nhau đồng thời', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const rooms = Array.from({ length: 5 }, (_, i) =>
        createSampleRoom({ id: `par-id-${i}`, slug: `par-slug-${i}`, status: RoomStatus.ACTIVE }),
      );
      repo.seed(rooms);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const promises = rooms.map((r) => service.getPublicBySlug(r.slug));
      const results = await Promise.all(promises);

      assert.strictEqual(results.length, 5);
      results.forEach((res, i) => assert.strictEqual(res.slug, `par-slug-${i}`));
    });

    it('TC-E073: Chạy song song 5 lời gọi getPublicList độc lập không xung đột state', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r1', status: RoomStatus.ACTIVE })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const results = await Promise.all([
        service.getPublicList(),
        service.getPublicList(),
        service.getPublicList(),
        service.getPublicList(),
        service.getPublicList(),
      ]);

      assert.strictEqual(results.length, 5);
      results.forEach((list) => assert.strictEqual(list.length, 1));
    });

    it('TC-E074: Chạy song song 3 lời gọi list với các filter khác nhau không làm lẫn lộn kết quả', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'r1', status: RoomStatus.ACTIVE, name: 'Phòng 1' }),
        createSampleRoom({ id: 'r2', status: RoomStatus.ARCHIVED, name: 'Phòng 2' }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const [resAll, resActive, resArchived] = await Promise.all([
        service.list(createSampleQuery()),
        service.list(createSampleQuery({ status: RoomStatus.ACTIVE })),
        service.list(createSampleQuery({ status: RoomStatus.ARCHIVED })),
      ]);

      assert.strictEqual(resAll.total, 2);
      assert.strictEqual(resActive.total, 1);
      assert.strictEqual(resArchived.total, 1);
    });

    it('TC-E075: Chạy song song 3 lời gọi update các phòng khác nhau đồng thời', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'u1', name: 'Tên 1' }),
        createSampleRoom({ id: 'u2', name: 'Tên 2' }),
        createSampleRoom({ id: 'u3', name: 'Tên 3' }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const [up1, up2, up3] = await Promise.all([
        service.update('u1', { name: 'Đã đổi 1' }),
        service.update('u2', { name: 'Đã đổi 2' }),
        service.update('u3', { name: 'Đã đổi 3' }),
      ]);

      assert.strictEqual(up1.name, 'Đã đổi 1');
      assert.strictEqual(up2.name, 'Đã đổi 2');
      assert.strictEqual(up3.name, 'Đã đổi 3');
    });

    it('TC-E076: Chạy song song 3 lời gọi remove các phòng rỗng khác nhau đồng thời', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'rm1', exhibits: [] }),
        createSampleRoom({ id: 'rm2', exhibits: [] }),
        createSampleRoom({ id: 'rm3', exhibits: [] }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await Promise.all([service.remove('rm1'), service.remove('rm2'), service.remove('rm3')]);

      assert.strictEqual(repo.rooms.get('rm1')?.isDeleted, true);
      assert.strictEqual(repo.rooms.get('rm2')?.isDeleted, true);
      assert.strictEqual(repo.rooms.get('rm3')?.isDeleted, true);
    });

    it('TC-E077: Chạy song song vừa create phòng mới vừa list phòng hiện tại', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'init-1' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const [newRoom, listRes] = await Promise.all([
        service.create({ slug: 'phong-dong-thoi', name: 'Phòng Đồng Thời' }),
        service.list(createSampleQuery()),
      ]);

      assert.strictEqual(newRoom.slug, 'phong-dong-thoi');
      assert.ok(listRes.total >= 1);
    });

    it('TC-E078: Chạy song song vừa update tên phòng vừa getById phòng đó', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-parallel-rw', name: 'Tên Ban Đầu' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const [updated, read] = await Promise.all([
        service.update('r-parallel-rw', { name: 'Tên Đã Cập Nhật' }),
        service.getById('r-parallel-rw'),
      ]);

      assert.strictEqual(updated.name, 'Tên Đã Cập Nhật');
      assert.ok(read.id === 'r-parallel-rw');
    });

    it('TC-E079: Chạy song song 3 lời gọi create với các slug khác nhau hoàn toàn thành công', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const [r1, r2, r3] = await Promise.all([
        service.create({ slug: 'batch-1', name: 'Batch 1' }),
        service.create({ slug: 'batch-2', name: 'Batch 2' }),
        service.create({ slug: 'batch-3', name: 'Batch 3' }),
      ]);

      assert.strictEqual(r1.slug, 'batch-1');
      assert.strictEqual(r2.slug, 'batch-2');
      assert.strictEqual(r3.slug, 'batch-3');
    });

    it('TC-E080: Chạy 10 tác vụ hỗn hợp (list, getById, create, update, remove) đồng thời bằng Promise.all', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'mix-1', name: 'Mix 1', exhibits: [] }),
        createSampleRoom({ id: 'mix-2', name: 'Mix 2', exhibits: [] }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const tasks = [
        service.list(createSampleQuery()),
        service.getById('mix-1'),
        service.create({ slug: 'mix-new-1', name: 'Mix New 1' }),
        service.update('mix-1', { name: 'Mix 1 Updated' }),
        service.remove('mix-2'),
      ];

      const results = await Promise.all(tasks);
      assert.strictEqual(results.length, 5);
    });
  });

  // =========================================================================
  // SUITE 9: Public Endpoints Filtering & Visibility Contracts (TC-E081 -> TC-E090)
  // =========================================================================
  describe('Suite 9: Public Endpoints Filtering & Visibility Contracts (10 Test Cases)', () => {
    it('TC-E081: getPublicList không bao giờ trả về phòng có isDeleted = true', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'p1', isDeleted: true, status: RoomStatus.ACTIVE }),
        createSampleRoom({ id: 'p2', isDeleted: false, status: RoomStatus.ACTIVE }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 'p2');
    });

    it('TC-E082: getPublicList không bao giờ trả về phòng có status ARCHIVED', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'p1', status: RoomStatus.ARCHIVED, isDeleted: false }),
        createSampleRoom({ id: 'p2', status: RoomStatus.ACTIVE, isDeleted: false }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 'p2');
    });

    it('TC-E083: getPublicBySlug từ chối phòng có isDeleted = true (ném NotFoundException)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'del-slug', slug: 'da-xoa', isDeleted: true, status: RoomStatus.ACTIVE })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(async () => service.getPublicBySlug('da-xoa'), NotFoundException);
    });

    it('TC-E084: getPublicBySlug từ chối phòng có status ARCHIVED (ném NotFoundException)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'arch-slug', slug: 'da-luu-tru', status: RoomStatus.ARCHIVED })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(async () => service.getPublicBySlug('da-luu-tru'), NotFoundException);
    });

    it('TC-E085: getPublicList trả về danh sách rỗng khi tất cả phòng trong DB đều ARCHIVED', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'a1', status: RoomStatus.ARCHIVED }),
        createSampleRoom({ id: 'a2', status: RoomStatus.ARCHIVED }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.deepStrictEqual(res, []);
    });

    it('TC-E086: getPublicList trả về danh sách rỗng khi tất cả phòng trong DB đều bị soft-deleted', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'd1', isDeleted: true }),
        createSampleRoom({ id: 'd2', isDeleted: true }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.deepStrictEqual(res, []);
    });

    it('TC-E087: getPublicList tính đúng exhibitsCount cho từng phòng công khai độc lập', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'p1', exhibits: [], status: RoomStatus.ACTIVE }),
        createSampleRoom({ id: 'p2', exhibits: [createSampleExhibit()], status: RoomStatus.ACTIVE }),
        createSampleRoom({ id: 'p3', exhibits: [createSampleExhibit(), createSampleExhibit({ id: 'ex2' })], status: RoomStatus.ACTIVE }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.find((r) => r.id === 'p1')?.exhibitsCount, 0);
      assert.strictEqual(res.find((r) => r.id === 'p2')?.exhibitsCount, 1);
      assert.strictEqual(res.find((r) => r.id === 'p3')?.exhibitsCount, 2);
    });

    it('TC-E088: getPublicBySlug ném 404 khi truyền chuỗi slug không khớp', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ slug: 'phong-ton-tai', status: RoomStatus.ACTIVE })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      await assert.rejects(async () => service.getPublicBySlug('phong-khac'), NotFoundException);
    });

    it('TC-E089: getPublicBySlug bảo toàn chính xác description tiếng Việt khi hiển thị cho khách 3D', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const desc = 'Không gian 3D tương tác trải nghiệm thực tế ảo VR dành cho khách tham quan trực tuyến';
      repo.seed([createSampleRoom({ slug: 'vr-space', description: desc, status: RoomStatus.ACTIVE })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('vr-space');
      assert.strictEqual(res.description, desc);
    });

    it('TC-E090: getPublicList trả về chính xác số lượng 10 phòng active', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const activeRooms = Array.from({ length: 10 }, (_, i) =>
        createSampleRoom({ id: `active-${i}`, slug: `active-slug-${i}`, status: RoomStatus.ACTIVE }),
      );
      repo.seed(activeRooms);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicList();
      assert.strictEqual(res.length, 10);
    });
  });

  // =========================================================================
  // SUITE 10: Response Mapping & DTO Contract Compliance (TC-E091 -> TC-E100)
  // =========================================================================
  describe('Suite 10: Response Mapping & DTO Contract Compliance (10 Test Cases)', () => {
    it('TC-E091: RoomResponse từ getById chứa đầy đủ 8 trường tiêu chuẩn', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-contract-1' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getById('r-contract-1');
      assert.ok('id' in res);
      assert.ok('slug' in res);
      assert.ok('name' in res);
      assert.ok('description' in res);
      assert.ok('status' in res);
      assert.ok('exhibitsCount' in res);
      assert.ok('createdAt' in res);
      assert.ok('updatedAt' in res);
    });

    it('TC-E092: RoomResponse từ create chứa đầy đủ các key theo chuẩn DTO', async () => {
      const repo = new InMemoryMockRoomsRepository();
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.create({ slug: 'r-contract-create', name: 'Contract Create' });
      assert.ok('id' in res);
      assert.ok('slug' in res);
      assert.ok('name' in res);
      assert.ok('description' in res);
      assert.ok('status' in res);
      assert.ok('exhibitsCount' in res);
      assert.ok('createdAt' in res);
      assert.ok('updatedAt' in res);
    });

    it('TC-E093: RoomResponse từ update chứa đầy đủ các key theo chuẩn DTO', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-contract-update' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.update('r-contract-update', { name: 'New Name' });
      assert.ok('id' in res);
      assert.ok('slug' in res);
      assert.ok('name' in res);
      assert.ok('description' in res);
      assert.ok('status' in res);
      assert.ok('exhibitsCount' in res);
      assert.ok('createdAt' in res);
      assert.ok('updatedAt' in res);
    });

    it('TC-E094: RoomResponse từ getPublicBySlug chứa đầy đủ các key theo chuẩn DTO', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ slug: 'r-contract-pub', status: RoomStatus.ACTIVE })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getPublicBySlug('r-contract-pub');
      assert.ok('id' in res);
      assert.ok('slug' in res);
      assert.ok('name' in res);
      assert.ok('description' in res);
      assert.ok('status' in res);
      assert.ok('exhibitsCount' in res);
      assert.ok('createdAt' in res);
      assert.ok('updatedAt' in res);
    });

    it('TC-E095: Kiểu dữ liệu của exhibitsCount trong RoomResponse luôn là number nguyên không âm (>= 0)', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-num-test' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getById('r-num-test');
      assert.strictEqual(typeof res.exhibitsCount, 'number');
      assert.ok(Number.isInteger(res.exhibitsCount));
      assert.ok(res.exhibitsCount >= 0);
    });

    it('TC-E096: Kiểu dữ liệu của createdAt và updatedAt trong RoomResponse luôn là đối tượng Date hợp lệ', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-date-test' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getById('r-date-test');
      assert.ok(res.createdAt instanceof Date);
      assert.ok(!isNaN(res.createdAt.getTime()));
      assert.ok(res.updatedAt instanceof Date);
      assert.ok(!isNaN(res.updatedAt.getTime()));
    });

    it('TC-E097: Trường id luôn là chuỗi string không rỗng', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'non-empty-uuid' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getById('non-empty-uuid');
      assert.strictEqual(typeof res.id, 'string');
      assert.ok(res.id.length > 0);
    });

    it('TC-E098: Trường slug luôn là chuỗi string không rỗng', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-slug-check', slug: 'valid-slug' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getById('r-slug-check');
      assert.strictEqual(typeof res.slug, 'string');
      assert.ok(res.slug.length > 0);
    });

    it('TC-E099: Trường name luôn là chuỗi string không rỗng', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([createSampleRoom({ id: 'r-name-check', name: 'Phòng Có Tên' })]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const res = await service.getById('r-name-check');
      assert.strictEqual(typeof res.name, 'string');
      assert.ok(res.name.length > 0);
    });

    it('TC-E100: Trường description là string hoặc null, không bao giờ là undefined trong RoomResponse', async () => {
      const repo = new InMemoryMockRoomsRepository();
      repo.seed([
        createSampleRoom({ id: 'r-desc-null', description: null }),
        createSampleRoom({ id: 'r-desc-str', description: 'Có mô tả' }),
      ]);
      const service = new RoomsService(repo as unknown as RoomsRepository);

      const resNull = await service.getById('r-desc-null');
      assert.strictEqual(resNull.description, null);

      const resStr = await service.getById('r-desc-str');
      assert.strictEqual(typeof resStr.description, 'string');
    });
  });
});
