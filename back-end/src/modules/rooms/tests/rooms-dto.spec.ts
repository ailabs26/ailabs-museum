import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRoomDto } from '../dto/create-room.dto';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { RoomResponseDto, toRoomResponse } from '../dto/room-response.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { Room, RoomStatus } from '../entities/room.entity';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';

// Helper kiểm tra validation của DTO
async function validateDto<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance);
  return errors.map((e) => e.property);
}

// Helper kiểm tra transform và validation của DTO
async function transformAndValidate<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<{ instance: T; errors: string[] }> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance);
  return {
    instance,
    errors: errors.map((e) => e.property),
  };
}

describe('Task 6.1 — Rooms DTOs Comprehensive Test Suite (105 Test Cases)', () => {
  // ===========================================================================
  // SUITE 1: CreateRoomDto — Slug Validation (30 Test Cases)
  // ===========================================================================
  describe('Suite 1: CreateRoomDto — Slug Validation (30 Test Cases)', () => {
    it('TC-001: Cho phép slug một từ hợp lệ (phong)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong', name: 'Phòng 1' });
      assert.ok(!errors.includes('slug'), 'Slug hợp lệ không được có lỗi');
    });

    it('TC-002: Cho phép slug nhiều từ kebab-case hợp lệ (phong-kham-pha)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-kham-pha', name: 'Phòng Khám Phá' });
      assert.ok(!errors.includes('slug'));
    });

    it('TC-003: Cho phép slug có số ở cuối (phong-so-1)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-so-1', name: 'Phòng Số 1' });
      assert.ok(!errors.includes('slug'));
    });

    it('TC-004: Cho phép slug có số ở giữa (gallery-2026-aura)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'gallery-2026-aura', name: 'Gallery 2026' });
      assert.ok(!errors.includes('slug'));
    });

    it('TC-005: Cho phép slug chỉ có 1 ký tự chữ cái (a)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'a', name: 'Khu A' });
      assert.ok(!errors.includes('slug'));
    });

    it('TC-006: Cho phép slug chỉ có 1 chữ số (1)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: '1', name: 'Khu 1' });
      assert.ok(!errors.includes('slug'));
    });

    it('TC-007: Tự động chuyển slug chữ hoa thành chữ thường (PHONG-KHAM-PHA -> phong-kham-pha)', async () => {
      const { instance, errors } = await transformAndValidate(CreateRoomDto, {
        slug: 'PHONG-KHAM-PHA',
        name: 'Phòng Khám Phá',
      });
      assert.equal(instance.slug, 'phong-kham-pha');
      assert.ok(!errors.includes('slug'));
    });

    it('TC-008: Tự động chuyển slug chữ hoa pha trộn (Phong-So-1 -> phong-so-1)', async () => {
      const { instance, errors } = await transformAndValidate(CreateRoomDto, {
        slug: 'Phong-So-1',
        name: 'Phòng Số 1',
      });
      assert.equal(instance.slug, 'phong-so-1');
      assert.ok(!errors.includes('slug'));
    });

    it('TC-009: Tự động trim khoảng trắng ở đầu và cuối slug (   phong-1   -> phong-1)', async () => {
      const { instance, errors } = await transformAndValidate(CreateRoomDto, {
        slug: '   phong-1   ',
        name: 'Phòng 1',
      });
      assert.equal(instance.slug, 'phong-1');
      assert.ok(!errors.includes('slug'));
    });

    it('TC-010: Cho phép slug đạt đúng độ dài tối đa 120 ký tự', async () => {
      // 24 đoạn "abcde" cách nhau bởi "-" = 20 ký tự mỗi khối: "abcde-abcde-..."
      const longSlug = Array.from({ length: 20 }, () => 'abcde').join('-'); // 5 * 20 + 19 = 119 ký tự
      const valid120Slug = `${longSlug}-a`; // 121 -> sửa thành 120
      const exact120Slug = valid120Slug.slice(0, 120).replace(/-$/, 'a');
      assert.equal(exact120Slug.length, 120);

      const errors = await validateDto(CreateRoomDto, { slug: exact120Slug, name: 'Phòng Dài' });
      assert.ok(!errors.includes('slug'));
    });

    it('TC-011: Bắt lỗi khi slug là chuỗi rỗng ("")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: '', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-012: Bắt lỗi khi slug chỉ gồm khoảng trắng ("   ")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: '   ', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-013: Bắt lỗi khi thiếu trường slug (undefined)', async () => {
      const errors = await validateDto(CreateRoomDto, { name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-014: Bắt lỗi khi slug là null', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: null, name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-015: Bắt lỗi khi slug là kiểu số (12345)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 12345, name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-016: Bắt lỗi khi slug là kiểu boolean (true)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: true, name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-017: Bắt lỗi khi slug là object ({})', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: {}, name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-018: Bắt lỗi khi slug là mảng ([])', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: ['phong'], name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-019: Bắt lỗi khi slug có dấu gạch ngang ở đầu (-phong)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: '-phong', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-020: Bắt lỗi khi slug có dấu gạch ngang ở cuối (phong-)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-021: Bắt lỗi khi slug có hai dấu gạch ngang liền nhau (phong--kham--pha)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong--kham--pha', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-022: Bắt lỗi khi slug chứa khoảng trắng ở giữa (phong kham pha)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong kham pha', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-023: Bắt lỗi khi slug chứa dấu gạch dưới (phong_kham_pha)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong_kham_pha', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-024: Bắt lỗi khi slug chứa dấu chấm (phong.kham.pha)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong.kham.pha', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-025: Bắt lỗi khi slug chứa dấu gạch chéo (phong/kham)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong/kham', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-026: Bắt lỗi khi slug chứa ký tự đặc biệt @ (phong@123)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong@123', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-027: Bắt lỗi khi slug chứa dấu chấm than ! (phong!)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong!', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-028: Bắt lỗi khi slug chứa tiếng Việt có dấu (phòng-khám-phá)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phòng-khám-phá', name: 'Phòng' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-029: Bắt lỗi khi slug chứa từ tiếng Việt đơn có dấu (lịch-sử)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'lịch-sử', name: 'Lịch Sử' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-030: Bắt lỗi khi slug vượt quá 120 ký tự (121 ký tự)', async () => {
      const slug121 = `${'a'.repeat(60)}-${'b'.repeat(60)}`; // 60 + 1 + 60 = 121
      assert.equal(slug121.length, 121);
      const errors = await validateDto(CreateRoomDto, { slug: slug121, name: 'Phòng Quá Dài' });
      assert.ok(errors.includes('slug'));
    });

    it('TC-030b (VT-077): Bắt lỗi khi slug trùng từ khóa dành riêng (search)', async () => {
      // Slug "search" hợp lệ theo regex kebab-case nhưng xung đột route GET /rooms/search → phải chặn.
      const errors = await validateDto(CreateRoomDto, { slug: 'search', name: 'Phòng Tìm Kiếm' });
      assert.ok(errors.includes('slug'), 'slug "search" phải bị từ chối');
    });

    it('TC-030c (VT-077): Vẫn cho phép slug CHỨA từ dành riêng nhưng khác (search-room)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'search-room', name: 'Phòng' });
      assert.ok(!errors.includes('slug'), 'chỉ chặn đúng "search", không chặn slug chứa từ đó');
    });
  });

  // ===========================================================================
  // SUITE 2: CreateRoomDto — Name & Description Validation (25 Test Cases)
  // ===========================================================================
  describe('Suite 2: CreateRoomDto — Name & Description Validation (25 Test Cases)', () => {
    it('TC-031: Cho phép tên tiếng Việt đầy đủ có dấu ("Phòng Khám Phá")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-kham-pha', name: 'Phòng Khám Phá' });
      assert.ok(!errors.includes('name'));
    });

    it('TC-032: Cho phép tên tiếng Anh ("Modern Art Gallery")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'modern-art', name: 'Modern Art Gallery' });
      assert.ok(!errors.includes('name'));
    });

    it('TC-033: Cho phép tên có chứa dấu câu và ngoặc đơn ("Phòng: Cổ Vật (Khu A)")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'co-vat-a', name: 'Phòng: Cổ Vật (Khu A)' });
      assert.ok(!errors.includes('name'));
    });

    it('TC-034: Cho phép tên có chứa số ("Phòng Số 1 - Tầng 2")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1-tang-2', name: 'Phòng Số 1 - Tầng 2' });
      assert.ok(!errors.includes('name'));
    });

    it('TC-035: Cho phép tên có độ dài tối thiểu 1 ký tự ("A")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'khu-a', name: 'A' });
      assert.ok(!errors.includes('name'));
    });

    it('TC-036: Cho phép tên đạt đúng độ dài tối đa 200 ký tự', async () => {
      const name200 = 'A'.repeat(200);
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-dai', name: name200 });
      assert.ok(!errors.includes('name'));
    });

    it('TC-037: Tự động trim khoảng trắng ở đầu và cuối tên ("   Phòng A   ")', async () => {
      const { instance, errors } = await transformAndValidate(CreateRoomDto, {
        slug: 'phong-a',
        name: '   Phòng A   ',
      });
      assert.equal(instance.name, 'Phòng A');
      assert.ok(!errors.includes('name'));
    });

    it('TC-038: Bắt lỗi khi tên là chuỗi rỗng ("")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: '' });
      assert.ok(errors.includes('name'));
    });

    it('TC-039: Bắt lỗi khi tên chỉ gồm khoảng trắng ("     ")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: '     ' });
      assert.ok(errors.includes('name'));
    });

    it('TC-040: Bắt lỗi khi thiếu trường name (undefined)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1' });
      assert.ok(errors.includes('name'));
    });

    it('TC-041: Bắt lỗi khi name là null', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: null });
      assert.ok(errors.includes('name'));
    });

    it('TC-042: Bắt lỗi khi name là số (12345)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: 12345 });
      assert.ok(errors.includes('name'));
    });

    it('TC-043: Bắt lỗi khi name là boolean (false)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: false });
      assert.ok(errors.includes('name'));
    });

    it('TC-044: Bắt lỗi khi name là object ({})', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: {} });
      assert.ok(errors.includes('name'));
    });

    it('TC-045: Bắt lỗi khi name là mảng ([])', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: [] });
      assert.ok(errors.includes('name'));
    });

    it('TC-046: Bắt lỗi khi name vượt quá 200 ký tự (201 ký tự)', async () => {
      const name201 = 'A'.repeat(201);
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: name201 });
      assert.ok(errors.includes('name'));
    });

    it('TC-047: Cho phép không truyền description (undefined)', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: 'Phòng 1' });
      assert.ok(!errors.includes('description'));
    });

    it('TC-048: Cho phép description là chuỗi rỗng ("")', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: 'phong-1', name: 'Phòng 1', description: '' });
      assert.ok(!errors.includes('description'));
    });

    it('TC-049: Cho phép description văn bản bình thường', async () => {
      const errors = await validateDto(CreateRoomDto, {
        slug: 'phong-1',
        name: 'Phòng 1',
        description: 'Mô tả không gian bảo tàng',
      });
      assert.ok(!errors.includes('description'));
    });

    it('TC-050: Cho phép description nhiều dòng (multiline)', async () => {
      const errors = await validateDto(CreateRoomDto, {
        slug: 'phong-1',
        name: 'Phòng 1',
        description: 'Dòng 1\nDòng 2\nDòng 3',
      });
      assert.ok(!errors.includes('description'));
    });

    it('TC-051: Cho phép description chứa emoji và unicode ("Trưng bày 🏛️")', async () => {
      const errors = await validateDto(CreateRoomDto, {
        slug: 'phong-1',
        name: 'Phòng 1',
        description: 'Trưng bày 🏛️ nghệ thuật điêu khắc',
      });
      assert.ok(!errors.includes('description'));
    });

    it('TC-052: Tự động trim khoảng trắng thừa trong description', async () => {
      const { instance, errors } = await transformAndValidate(CreateRoomDto, {
        slug: 'phong-1',
        name: 'Phòng 1',
        description: '   Mô tả có khoảng trắng   ',
      });
      assert.equal(instance.description, 'Mô tả có khoảng trắng');
      assert.ok(!errors.includes('description'));
    });

    it('TC-053: Bắt lỗi khi description là kiểu số (12345)', async () => {
      const errors = await validateDto(CreateRoomDto, {
        slug: 'phong-1',
        name: 'Phòng 1',
        description: 12345,
      });
      assert.ok(errors.includes('description'));
    });

    it('TC-054: Bắt lỗi khi description là object ({})', async () => {
      const errors = await validateDto(CreateRoomDto, {
        slug: 'phong-1',
        name: 'Phòng 1',
        description: {},
      });
      assert.ok(errors.includes('description'));
    });

    it('TC-055: Bắt lỗi đồng thời cả slug và name khi cả hai đều sai', async () => {
      const errors = await validateDto(CreateRoomDto, { slug: '', name: '' });
      assert.ok(errors.includes('slug'), 'Phải báo lỗi slug');
      assert.ok(errors.includes('name'), 'Phải báo lỗi name');
    });
  });

  // ===========================================================================
  // SUITE 3: UpdateRoomDto — Partial Update & Status Validation (20 Test Cases)
  // ===========================================================================
  describe('Suite 3: UpdateRoomDto — Partial Update & Status Validation (20 Test Cases)', () => {
    it('TC-056: Cho phép object rỗng {} khi cập nhật (mọi trường tùy chọn)', async () => {
      const errors = await validateDto(UpdateRoomDto, {});
      assert.equal(errors.length, 0);
    });

    it('TC-057: Cho phép cập nhật chỉ riêng tên', async () => {
      const errors = await validateDto(UpdateRoomDto, { name: 'Tên Mới' });
      assert.ok(!errors.includes('name'));
    });

    it('TC-058: Cho phép cập nhật chỉ riêng mô tả', async () => {
      const errors = await validateDto(UpdateRoomDto, { description: 'Mô tả cập nhật mới' });
      assert.ok(!errors.includes('description'));
    });

    it('TC-059: Cho phép cập nhật status thành "active"', async () => {
      const errors = await validateDto(UpdateRoomDto, { status: RoomStatus.ACTIVE });
      assert.ok(!errors.includes('status'));
    });

    it('TC-060: Cho phép cập nhật status thành "archived"', async () => {
      const errors = await validateDto(UpdateRoomDto, { status: RoomStatus.ARCHIVED });
      assert.ok(!errors.includes('status'));
    });

    it('TC-061: Cho phép cập nhật đồng thời cả name và description', async () => {
      const errors = await validateDto(UpdateRoomDto, {
        name: 'Tên Mới',
        description: 'Mô tả mới',
      });
      assert.equal(errors.length, 0);
    });

    it('TC-062: Cho phép cập nhật đầy đủ cả 3 trường (name, description, status)', async () => {
      const errors = await validateDto(UpdateRoomDto, {
        name: 'Phòng Khảo Cổ',
        description: 'Khu vực khai quật',
        status: RoomStatus.ARCHIVED,
      });
      assert.equal(errors.length, 0);
    });

    it('TC-063: Tự động trim khoảng trắng khi cập nhật tên ("   Tên Cập Nhật   ")', async () => {
      const { instance, errors } = await transformAndValidate(UpdateRoomDto, {
        name: '   Tên Cập Nhật   ',
      });
      assert.equal(instance.name, 'Tên Cập Nhật');
      assert.ok(!errors.includes('name'));
    });

    it('TC-064: Tự động trim khoảng trắng khi cập nhật mô tả ("   Mô Tả Cập Nhật   ")', async () => {
      const { instance, errors } = await transformAndValidate(UpdateRoomDto, {
        description: '   Mô Tả Cập Nhật   ',
      });
      assert.equal(instance.description, 'Mô Tả Cập Nhật');
      assert.ok(!errors.includes('description'));
    });

    it('TC-065: Cho phép cập nhật mô tả thành chuỗi rỗng để xóa mô tả', async () => {
      const errors = await validateDto(UpdateRoomDto, { description: '' });
      assert.ok(!errors.includes('description'));
    });

    it('TC-066: Bắt lỗi khi cập nhật tên thành chuỗi rỗng ("")', async () => {
      const errors = await validateDto(UpdateRoomDto, { name: '' });
      assert.ok(errors.includes('name'));
    });

    it('TC-067: Bắt lỗi khi cập nhật tên thành chuỗi chỉ gồm khoảng trắng ("   ")', async () => {
      const errors = await validateDto(UpdateRoomDto, { name: '   ' });
      assert.ok(errors.includes('name'));
    });

    it('TC-068: Bắt lỗi khi cập nhật tên vượt quá 200 ký tự (201 ký tự)', async () => {
      const name201 = 'B'.repeat(201);
      const errors = await validateDto(UpdateRoomDto, { name: name201 });
      assert.ok(errors.includes('name'));
    });

    it('TC-069: Bắt lỗi khi cập nhật tên là kiểu số (999)', async () => {
      const errors = await validateDto(UpdateRoomDto, { name: 999 });
      assert.ok(errors.includes('name'));
    });

    it('TC-070: Bắt lỗi khi cập nhật status giá trị không hợp lệ ("deleted")', async () => {
      const errors = await validateDto(UpdateRoomDto, { status: 'deleted' });
      assert.ok(errors.includes('status'));
    });

    it('TC-071: Bắt lỗi khi cập nhật status giá trị "draft"', async () => {
      const errors = await validateDto(UpdateRoomDto, { status: 'draft' });
      assert.ok(errors.includes('status'));
    });

    it('TC-072: Bắt lỗi khi cập nhật status giá trị "pending"', async () => {
      const errors = await validateDto(UpdateRoomDto, { status: 'pending' });
      assert.ok(errors.includes('status'));
    });

    it('TC-073: Bắt lỗi khi cập nhật status viết hoa chữ thường ("ACTIVE")', async () => {
      const errors = await validateDto(UpdateRoomDto, { status: 'ACTIVE' });
      assert.ok(errors.includes('status'));
    });

    it('TC-074: Bắt lỗi khi cập nhật status là kiểu số (1)', async () => {
      const errors = await validateDto(UpdateRoomDto, { status: 1 });
      assert.ok(errors.includes('status'));
    });

    it('TC-075: Bắt lỗi khi cập nhật mô tả là kiểu boolean (false)', async () => {
      const errors = await validateDto(UpdateRoomDto, { description: false });
      assert.ok(errors.includes('description'));
    });
  });

  // ===========================================================================
  // SUITE 4: ListRoomsQueryDto — Pagination & Filter Validation (18 Test Cases)
  // ===========================================================================
  describe('Suite 4: ListRoomsQueryDto — Pagination & Filter Validation (18 Test Cases)', () => {
    it('TC-076: Khởi tạo giá trị mặc định chuẩn (page = 1, pageSize = 20, skip = 0)', async () => {
      const query = plainToInstance(ListRoomsQueryDto, {});
      assert.equal(query.page, 1);
      assert.equal(query.pageSize, 20);
      assert.equal(query.skip, 0);
    });

    it('TC-077: Cho phép chỉ định page tùy chỉnh hợp lệ (page = 5)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { page: 5 });
      assert.ok(!errors.includes('page'));
    });

    it('TC-078: Cho phép page tại biên nhỏ nhất (page = 1)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { page: 1 });
      assert.ok(!errors.includes('page'));
    });

    it('TC-079: Cho phép pageSize tại biên nhỏ nhất (pageSize = 1)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { pageSize: 1 });
      assert.ok(!errors.includes('pageSize'));
    });

    it('TC-080: Cho phép pageSize tại biên lớn nhất (pageSize = 100)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { pageSize: 100 });
      assert.ok(!errors.includes('pageSize'));
    });

    it('TC-081: Cho phép pageSize bình thường (pageSize = 50)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { pageSize: 50 });
      assert.ok(!errors.includes('pageSize'));
    });

    it('TC-082: Cho phép lọc theo status "active"', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { status: RoomStatus.ACTIVE });
      assert.ok(!errors.includes('status'));
    });

    it('TC-083: Cho phép lọc theo status "archived"', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { status: RoomStatus.ARCHIVED });
      assert.ok(!errors.includes('status'));
    });

    it('TC-084: Cho phép tìm kiếm bằng từ khóa q ("phong")', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { q: 'phong' });
      assert.ok(!errors.includes('q'));
    });

    it('TC-085: Cho phép tìm kiếm bằng từ khóa q có dấu ("khám phá")', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { q: 'khám phá' });
      assert.ok(!errors.includes('q'));
    });

    it('TC-086: Cho phép chuỗi sắp xếp sort ("createdAt:desc")', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { sort: 'createdAt:desc' });
      assert.ok(!errors.includes('sort'));
    });

    it('TC-087: Tính toán đúng getter skip khi page = 1, pageSize = 20 (skip = 0)', () => {
      const query = plainToInstance(ListRoomsQueryDto, { page: 1, pageSize: 20 });
      assert.equal(query.skip, 0);
    });

    it('TC-088: Tính toán đúng getter skip khi page = 3, pageSize = 10 (skip = 20)', () => {
      const query = plainToInstance(ListRoomsQueryDto, { page: 3, pageSize: 10 });
      assert.equal(query.skip, 20);
    });

    it('TC-089: Tính toán đúng getter skip khi page = 10, pageSize = 20 (skip = 180)', () => {
      const query = plainToInstance(ListRoomsQueryDto, { page: 10, pageSize: 20 });
      assert.equal(query.skip, 180);
    });

    it('TC-090: Bắt lỗi khi page = 0 (nhỏ hơn min 1)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { page: 0 });
      assert.ok(errors.includes('page'));
    });

    it('TC-091: Bắt lỗi khi page là số âm (page = -5)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { page: -5 });
      assert.ok(errors.includes('page'));
    });

    it('TC-092: Bắt lỗi khi pageSize = 0 (nhỏ hơn min 1)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { pageSize: 0 });
      assert.ok(errors.includes('pageSize'));
    });

    it('TC-093: Bắt lỗi khi pageSize vượt quá 100 (pageSize = 101)', async () => {
      const errors = await validateDto(ListRoomsQueryDto, { pageSize: 101 });
      assert.ok(errors.includes('pageSize'));
    });
  });

  // ===========================================================================
  // SUITE 5: RoomResponseDto & Mapping Logic (12 Test Cases)
  // ===========================================================================
  describe('Suite 5: RoomResponseDto & Mapping Logic (12 Test Cases)', () => {
    function createMockRoom(overrides?: Partial<Room>): Room {
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

    it('TC-094: Tính đúng exhibitsCount khi mảng exhibits có 3 hiện vật', () => {
      const room = createMockRoom({
        exhibits: [new Exhibit(), new Exhibit(), new Exhibit()],
      });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.exhibitsCount, 3);
    });

    it('TC-095: Gán exhibitsCount = 0 khi mảng exhibits là mảng rỗng []', () => {
      const room = createMockRoom({ exhibits: [] });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.exhibitsCount, 0);
    });

    it('TC-096: Gán exhibitsCount = 0 khi relation exhibits là undefined', () => {
      const room = createMockRoom();
      // @ts-expect-error test undefined exhibits
      delete room.exhibits;
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.exhibitsCount, 0);
    });

    it('TC-097: Cho phép truyền exhibitsCount tường minh ghi đè', () => {
      const room = createMockRoom({ exhibits: [] });
      const response = RoomResponseDto.fromEntity(room, 99);
      assert.equal(response.exhibitsCount, 99);
    });

    it('TC-098: Bảo toàn đúng giá trị description là null khi entity không có mô tả', () => {
      const room = createMockRoom({ description: null });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.description, null);
    });

    it('TC-099: Bảo toàn đúng chuỗi mô tả khi entity có description', () => {
      const room = createMockRoom({ description: 'Không gian văn hóa' });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.description, 'Không gian văn hóa');
    });

    it('TC-100: Bảo toàn đúng trạng thái status là "active"', () => {
      const room = createMockRoom({ status: RoomStatus.ACTIVE });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.status, RoomStatus.ACTIVE);
    });

    it('TC-101: Bảo toàn đúng trạng thái status là "archived"', () => {
      const room = createMockRoom({ status: RoomStatus.ARCHIVED });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.status, RoomStatus.ARCHIVED);
    });

    it('TC-102: Giữ nguyên định dạng UUID của trường id', () => {
      const uuid = '241fab2e-ed74-4c6d-98d0-324ea98c67d7';
      const room = createMockRoom({ id: uuid });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal(response.id, uuid);
    });

    it('TC-103: Giữ nguyên đối tượng Date cho createdAt và updatedAt', () => {
      const room = createMockRoom();
      const response = RoomResponseDto.fromEntity(room);
      assert.ok(response.createdAt instanceof Date);
      assert.ok(response.updatedAt instanceof Date);
      assert.equal(response.createdAt.toISOString(), '2026-10-10T10:00:00.000Z');
    });

    it('TC-104: Hàm toRoomResponse() trả kết quả hoàn toàn khớp với RoomResponseDto.fromEntity()', () => {
      const room = createMockRoom({ exhibits: [new Exhibit()] });
      const res1 = RoomResponseDto.fromEntity(room);
      const res2 = toRoomResponse(room);
      assert.deepEqual(res1, res2);
    });

    it('TC-105: An toàn dữ liệu — không rò rỉ các trường nhạy cảm/nội bộ isDeleted và deletedAt', () => {
      const room = createMockRoom({ isDeleted: true, deletedAt: new Date() });
      const response = RoomResponseDto.fromEntity(room);
      assert.equal('isDeleted' in response, false, 'Không được có isDeleted trong response');
      assert.equal('deletedAt' in response, false, 'Không được có deletedAt trong response');
    });
  });
});
