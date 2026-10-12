import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reflector } from '@nestjs/core';
import { AUDIT_KEY } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { Paginated } from '../../../common/types/paginated.type';
import { AdminRoomsController } from '../controllers/admin-rooms.controller';
import { PublicRoomsController } from '../controllers/public-rooms.controller';
import { CreateRoomDto } from '../dto/create-room.dto';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { RoomResponse } from '../dto/room-response.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { RoomStatus } from '../entities/room.entity';
import { RoomsService } from '../services/rooms.service';

// Mock RoomResponse mẫu
function createMockRoomResponse(overrides?: Partial<RoomResponse>): RoomResponse {
  return {
    id: overrides?.id ?? 'e4b50c18-971c-4b68-b39f-f5cf171a8123',
    slug: overrides?.slug ?? 'phong-kham-pha',
    name: overrides?.name ?? 'Phòng Khám Phá',
    description: overrides && 'description' in overrides ? (overrides.description ?? null) : 'Mô tả phòng',
    status: overrides?.status ?? RoomStatus.ACTIVE,
    exhibitsCount: overrides?.exhibitsCount ?? 0,
    createdAt: overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z'),
    updatedAt: overrides?.updatedAt ?? new Date('2026-10-10T12:00:00Z'),
  };
}

// Mock RoomsService
class MockRoomsService {
  listCalls: ListRoomsQueryDto[] = [];
  listResult: Paginated<RoomResponse> = { items: [], total: 0, page: 1, pageSize: 20 };
  listError?: Error;

  getByIdCalls: string[] = [];
  getByIdResult: RoomResponse = createMockRoomResponse();
  getByIdError?: Error;

  getPublicListCallsCount = 0;
  getPublicListResult: RoomResponse[] = [];
  getPublicListError?: Error;

  getPublicBySlugCalls: string[] = [];
  getPublicBySlugResult: RoomResponse = createMockRoomResponse();
  getPublicBySlugError?: Error;

  createCalls: CreateRoomDto[] = [];
  createResult: RoomResponse = createMockRoomResponse();
  createError?: Error;

  updateCalls: Array<{ id: string; dto: UpdateRoomDto }> = [];
  updateResult: RoomResponse = createMockRoomResponse();
  updateError?: Error;

  removeCalls: string[] = [];
  removeError?: Error;

  async list(query: ListRoomsQueryDto): Promise<Paginated<RoomResponse>> {
    this.listCalls.push(query);
    if (this.listError) throw this.listError;
    return this.listResult;
  }

  async getById(id: string): Promise<RoomResponse> {
    this.getByIdCalls.push(id);
    if (this.getByIdError) throw this.getByIdError;
    return this.getByIdResult;
  }

  async getPublicList(): Promise<RoomResponse[]> {
    this.getPublicListCallsCount++;
    if (this.getPublicListError) throw this.getPublicListError;
    return this.getPublicListResult;
  }

  async getPublicBySlug(slug: string): Promise<RoomResponse> {
    this.getPublicBySlugCalls.push(slug);
    if (this.getPublicBySlugError) throw this.getPublicBySlugError;
    return this.getPublicBySlugResult;
  }

  async create(dto: CreateRoomDto): Promise<RoomResponse> {
    this.createCalls.push(dto);
    if (this.createError) throw this.createError;
    return this.createResult;
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomResponse> {
    this.updateCalls.push({ id, dto });
    if (this.updateError) throw this.updateError;
    return this.updateResult;
  }

  async remove(id: string): Promise<void> {
    this.removeCalls.push(id);
    if (this.removeError) throw this.removeError;
  }
}

describe('Task 6.4 — Controllers Layer Unit Test Suite (Admin & Public)', () => {
  const reflector = new Reflector();

  // =========================================================================
  // SUITE 1: Security & Decorator Metadata Inspection
  // =========================================================================
  describe('Suite 1: Security & Decorator Metadata Inspection', () => {
    it('TC-C001: AdminRoomsController được gắn tiền tố route "admin/rooms"', () => {
      const path = Reflect.getMetadata('path', AdminRoomsController);
      assert.strictEqual(path, 'admin/rooms');
    });

    it('TC-C002: AdminRoomsController.list yêu cầu quyền room:read', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminRoomsController.prototype.list);
      assert.deepStrictEqual(perms, [PERMISSIONS.ROOM_READ]);
    });

    it('TC-C003: AdminRoomsController.getById yêu cầu quyền room:read', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminRoomsController.prototype.getById);
      assert.deepStrictEqual(perms, [PERMISSIONS.ROOM_READ]);
    });

    it('TC-C004: AdminRoomsController.create yêu cầu quyền room:create', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminRoomsController.prototype.create);
      assert.deepStrictEqual(perms, [PERMISSIONS.ROOM_CREATE]);
    });

    it('TC-C005: AdminRoomsController.create được gắn @Audit("room.create", "room")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminRoomsController.prototype.create);
      assert.deepStrictEqual(audit, { action: 'room.create', resourceType: 'room' });
    });

    it('TC-C006: AdminRoomsController.update yêu cầu quyền room:update', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminRoomsController.prototype.update);
      assert.deepStrictEqual(perms, [PERMISSIONS.ROOM_UPDATE]);
    });

    it('TC-C007: AdminRoomsController.update được gắn @Audit("room.update", "room")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminRoomsController.prototype.update);
      assert.deepStrictEqual(audit, { action: 'room.update', resourceType: 'room' });
    });

    it('TC-C008: AdminRoomsController.remove yêu cầu quyền room:delete', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminRoomsController.prototype.remove);
      assert.deepStrictEqual(perms, [PERMISSIONS.ROOM_DELETE]);
    });

    it('TC-C009: AdminRoomsController.remove được gắn @Audit("room.delete", "room")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminRoomsController.prototype.remove);
      assert.deepStrictEqual(audit, { action: 'room.delete', resourceType: 'room' });
    });

    it('TC-C010: PublicRoomsController được gắn tiền tố route "public/rooms"', () => {
      const path = Reflect.getMetadata('path', PublicRoomsController);
      assert.strictEqual(path, 'public/rooms');
    });

    it('TC-C011: PublicRoomsController được đánh dấu @Public() để bỏ qua JwtAuthGuard', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, PublicRoomsController);
      assert.strictEqual(isPublic, true);
    });
  });

  // =========================================================================
  // SUITE 2: AdminRoomsController Execution & Delegation
  // =========================================================================
  describe('Suite 2: AdminRoomsController Execution & Delegation', () => {
    it('TC-C012: list() chuyển tiếp query đúng sang RoomsService.list()', async () => {
      const mockService = new MockRoomsService();
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);
      const query = Object.assign(new ListRoomsQueryDto(), { page: 2, pageSize: 15 });

      await controller.list(query);
      assert.strictEqual(mockService.listCalls.length, 1);
      assert.deepStrictEqual(mockService.listCalls[0], query);
    });

    it('TC-C013: list() trả về kết quả phân trang chuẩn từ service', async () => {
      const mockService = new MockRoomsService();
      const sample = createMockRoomResponse();
      mockService.listResult = { items: [sample], total: 1, page: 1, pageSize: 20 };
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      const res = await controller.list(new ListRoomsQueryDto());
      assert.strictEqual(res.total, 1);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, sample.id);
    });

    it('TC-C014: getById() chuyển tiếp id sang RoomsService.getById()', async () => {
      const mockService = new MockRoomsService();
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);
      const id = '123e4567-e89b-12d3-a456-426614174000';

      await controller.getById(id);
      assert.strictEqual(mockService.getByIdCalls.length, 1);
      assert.strictEqual(mockService.getByIdCalls[0], id);
    });

    it('TC-C015: getById() trả về RoomResponse từ service', async () => {
      const mockService = new MockRoomsService();
      const sample = createMockRoomResponse({ name: 'Phòng Đặc Biệt' });
      mockService.getByIdResult = sample;
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      const res = await controller.getById(sample.id);
      assert.strictEqual(res.name, 'Phòng Đặc Biệt');
    });

    it('TC-C016: create() chuyển tiếp DTO sang RoomsService.create()', async () => {
      const mockService = new MockRoomsService();
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);
      const dto: CreateRoomDto = { slug: 'phong-moi', name: 'Phòng Mới' };

      await controller.create(dto);
      assert.strictEqual(mockService.createCalls.length, 1);
      assert.deepStrictEqual(mockService.createCalls[0], dto);
    });

    it('TC-C017: create() trả về RoomResponse sau khi tạo', async () => {
      const mockService = new MockRoomsService();
      mockService.createResult = createMockRoomResponse({ slug: 'phong-moi', name: 'Phòng Mới' });
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      const res = await controller.create({ slug: 'phong-moi', name: 'Phòng Mới' });
      assert.strictEqual(res.slug, 'phong-moi');
      assert.strictEqual(res.name, 'Phòng Mới');
    });

    it('TC-C018: update() chuyển tiếp id và DTO sang RoomsService.update()', async () => {
      const mockService = new MockRoomsService();
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);
      const id = 'target-update-id';
      const dto: UpdateRoomDto = { name: 'Tên Đổi', status: RoomStatus.ARCHIVED };

      await controller.update(id, dto);
      assert.strictEqual(mockService.updateCalls.length, 1);
      assert.strictEqual(mockService.updateCalls[0].id, id);
      assert.deepStrictEqual(mockService.updateCalls[0].dto, dto);
    });

    it('TC-C019: update() trả về RoomResponse sau khi cập nhật', async () => {
      const mockService = new MockRoomsService();
      mockService.updateResult = createMockRoomResponse({ name: 'Tên Đã Đổi' });
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      const res = await controller.update('id', { name: 'Tên Đã Đổi' });
      assert.strictEqual(res.name, 'Tên Đã Đổi');
    });

    it('TC-C020: remove() chuyển tiếp id sang RoomsService.remove()', async () => {
      const mockService = new MockRoomsService();
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);
      const id = 'target-remove-id';

      await controller.remove(id);
      assert.strictEqual(mockService.removeCalls.length, 1);
      assert.strictEqual(mockService.removeCalls[0], id);
    });

    it('TC-C021: remove() trả về undefined khi hoàn tất', async () => {
      const mockService = new MockRoomsService();
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      const res = await controller.remove('id');
      assert.strictEqual(res, undefined);
    });

    it('TC-C022: Chuyển tiếp ngoại lệ từ service khi list() ném lỗi', async () => {
      const mockService = new MockRoomsService();
      mockService.listError = new Error('Service list error');
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      await assert.rejects(async () => controller.list(new ListRoomsQueryDto()), (err: Error) => {
        assert.strictEqual(err.message, 'Service list error');
        return true;
      });
    });

    it('TC-C023: Chuyển tiếp ngoại lệ từ service khi create() ném lỗi ConflictException', async () => {
      const mockService = new MockRoomsService();
      mockService.createError = new Error('Conflict slug');
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      await assert.rejects(async () => controller.create({ slug: 's', name: 'n' }), (err: Error) => {
        assert.strictEqual(err.message, 'Conflict slug');
        return true;
      });
    });

    it('TC-C024: Chuyển tiếp ngoại lệ từ service khi remove() ném lỗi BR-20 ConflictException', async () => {
      const mockService = new MockRoomsService();
      mockService.removeError = new Error('BR-20 conflict exhibits');
      const controller = new AdminRoomsController(mockService as unknown as RoomsService);

      await assert.rejects(async () => controller.remove('id'), (err: Error) => {
        assert.strictEqual(err.message, 'BR-20 conflict exhibits');
        return true;
      });
    });
  });

  // =========================================================================
  // SUITE 3: PublicRoomsController Execution & Delegation
  // =========================================================================
  describe('Suite 3: PublicRoomsController Execution & Delegation', () => {
    it('TC-C025: getPublicList() gọi RoomsService.getPublicList() đúng 1 lần', async () => {
      const mockService = new MockRoomsService();
      const controller = new PublicRoomsController(mockService as unknown as RoomsService);

      await controller.getPublicList();
      assert.strictEqual(mockService.getPublicListCallsCount, 1);
    });

    it('TC-C025: getPublicList() trả về danh sách RoomResponse[]', async () => {
      const mockService = new MockRoomsService();
      mockService.getPublicListResult = [createMockRoomResponse({ name: 'Phòng 3D' })];
      const controller = new PublicRoomsController(mockService as unknown as RoomsService);

      const res = await controller.getPublicList();
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].name, 'Phòng 3D');
    });

    it('TC-C027: getPublicBySlug() chuyển tiếp đúng slug sang RoomsService.getPublicBySlug()', async () => {
      const mockService = new MockRoomsService();
      const controller = new PublicRoomsController(mockService as unknown as RoomsService);
      const slug = 'phong-co-vat-thoi-ly';

      await controller.getPublicBySlug(slug);
      assert.strictEqual(mockService.getPublicBySlugCalls.length, 1);
      assert.strictEqual(mockService.getPublicBySlugCalls[0], slug);
    });

    it('TC-C028: getPublicBySlug() trả về RoomResponse từ service', async () => {
      const mockService = new MockRoomsService();
      mockService.getPublicBySlugResult = createMockRoomResponse({ slug: 'vr-space' });
      const controller = new PublicRoomsController(mockService as unknown as RoomsService);

      const res = await controller.getPublicBySlug('vr-space');
      assert.strictEqual(res.slug, 'vr-space');
    });

    it('TC-C029: Chuyển tiếp ngoại lệ từ service khi getPublicBySlug() không tìm thấy phòng', async () => {
      const mockService = new MockRoomsService();
      mockService.getPublicBySlugError = new Error('Not found public room');
      const controller = new PublicRoomsController(mockService as unknown as RoomsService);

      await assert.rejects(async () => controller.getPublicBySlug('missing'), (err: Error) => {
        assert.strictEqual(err.message, 'Not found public room');
        return true;
      });
    });

    it('TC-C030: Chuyển tiếp ngoại lệ từ service khi getPublicList() ném lỗi DB', async () => {
      const mockService = new MockRoomsService();
      mockService.getPublicListError = new Error('Database down');
      const controller = new PublicRoomsController(mockService as unknown as RoomsService);

      await assert.rejects(async () => controller.getPublicList(), (err: Error) => {
        assert.strictEqual(err.message, 'Database down');
        return true;
      });
    });
  });
});
