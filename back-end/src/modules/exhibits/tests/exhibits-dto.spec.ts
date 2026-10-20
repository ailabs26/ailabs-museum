import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BilingualDescriptionDto, BilingualNameDto } from '../dto/bilingual-text.dto';
import { CreateExhibitDto } from '../dto/create-exhibit.dto';
import { ExhibitResponseDto, toExhibitResponse } from '../dto/exhibit-response.dto';
import { CreateHotspotDto } from '../dto/hotspot.dto';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import { validateForPublish } from '../dto/publish-validation.dto';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { Scale3Dto, Vector3Dto } from '../dto/vector3.dto';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';

// Helper kiểm tra danh sách thuộc tính bị lỗi validation của DTO
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

describe('Task 7.1 — Exhibits DTOs & Validation Comprehensive Test Suite (130 Test Cases)', () => {
  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
  const VALID_UUID_2 = '987fcdeb-51a2-43f7-9876-ba0987654321';

  // ===========================================================================
  // SUITE 1: CreateExhibitDto — RoomId & DisplayOrder Validation (15 Test Cases)
  // ===========================================================================
  describe('Suite 1: CreateExhibitDto — RoomId & DisplayOrder Validation (15 Test Cases)', () => {
    it('TC-001: Cho phép roomId là UUID v4 hợp lệ', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID });
      assert.ok(!errors.includes('roomId'), 'UUID hợp lệ không được báo lỗi');
    });

    it('TC-002: Bắt lỗi khi roomId bị bỏ trống (undefined)', async () => {
      const errors = await validateDto(CreateExhibitDto, {});
      assert.ok(errors.includes('roomId'), 'Thiếu roomId phải báo lỗi');
    });

    it('TC-003: Bắt lỗi khi roomId là chuỗi rỗng ("")', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: '' });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-004: Bắt lỗi khi roomId chỉ có khoảng trắng ("   ")', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: '   ' });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-005: Bắt lỗi khi roomId không đúng định dạng UUID ("abc-123")', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: 'abc-123' });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-006: Bắt lỗi khi roomId là UUID thiếu ký tự', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: '123e4567-e89b-12d3-a456-42661417400' });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-007: Bắt lỗi khi roomId là kiểu số (12345)', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: 12345 });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-008: Bắt lỗi khi roomId là boolean (true)', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: true });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-009: Bắt lỗi khi roomId là object ({})', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: {} });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-010: Bắt lỗi khi roomId là mảng ([])', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: [] });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-011: Khởi tạo mặc định displayOrder = 0 khi không truyền', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, { roomId: VALID_UUID });
      assert.ok(!errors.includes('displayOrder'));
      assert.equal(instance.displayOrder, 0);
    });

    it('TC-012: Cho phép displayOrder là số nguyên dương hợp lệ (5)', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        displayOrder: 5,
      });
      assert.ok(!errors.includes('displayOrder'));
      assert.equal(instance.displayOrder, 5);
    });

    it('TC-013: Cho phép displayOrder ở giá trị biên nhỏ nhất (0)', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        displayOrder: 0,
      });
      assert.ok(!errors.includes('displayOrder'));
      assert.equal(instance.displayOrder, 0);
    });

    it('TC-014: Bắt lỗi khi displayOrder là số âm (-1)', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        displayOrder: -1,
      });
      assert.ok(errors.includes('displayOrder'));
    });

    it('TC-015: Bắt lỗi khi displayOrder là số thực không phải số nguyên (1.5)', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        displayOrder: 1.5,
      });
      assert.ok(errors.includes('displayOrder'));
    });
  });

  // ===========================================================================
  // SUITE 2: BilingualNameDto & BilingualDescriptionDto Validation (25 Test Cases)
  // ===========================================================================
  describe('Suite 2: BilingualNameDto & BilingualDescriptionDto Validation (25 Test Cases)', () => {
    it('TC-016: Cho phép truyền name dạng object song ngữ đầy đủ ({ vi, en })', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        name: { vi: 'Trống đồng Đông Sơn', en: 'Dong Son Bronze Drum' },
      });
      assert.ok(!errors.includes('name'));
      assert.equal(instance.name?.vi, 'Trống đồng Đông Sơn');
      assert.equal(instance.name?.en, 'Dong Son Bronze Drum');
    });

    it('TC-017: Tự động wrap string sang { vi: string } khi truyền name dạng chuỗi đơn', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        name: 'Trống đồng Đông Sơn',
      });
      assert.ok(!errors.includes('name'));
      assert.equal(instance.name?.vi, 'Trống đồng Đông Sơn');
    });

    it('TC-018: Tự động trim khoảng trắng ở đầu và cuối tên tiếng Việt ("   Bình gốm   ")', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        name: { vi: '   Bình gốm thời Lý   ' },
      });
      assert.ok(!errors.includes('name'));
      assert.equal(instance.name?.vi, 'Bình gốm thời Lý');
    });

    it('TC-019: Tự động trim khoảng trắng ở đầu và cuối tên tiếng Anh ("   Ancient Pottery   ")', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        name: { vi: 'Bình gốm', en: '   Ancient Pottery   ' },
      });
      assert.ok(!errors.includes('name'));
      assert.equal(instance.name?.en, 'Ancient Pottery');
    });

    it('TC-020: Cho phép tên tiếng Việt đạt độ dài tối đa 200 ký tự', async () => {
      const longName = 'A'.repeat(200);
      const errors = await validateDto(BilingualNameDto, { vi: longName });
      assert.ok(!errors.includes('vi'));
    });

    it('TC-021: Bắt lỗi khi tên tiếng Việt vượt quá 200 ký tự (201 ký tự)', async () => {
      const tooLongName = 'A'.repeat(201);
      const errors = await validateDto(BilingualNameDto, { vi: tooLongName });
      assert.ok(errors.includes('vi'));
    });

    it('TC-022: Cho phép tên tiếng Anh đạt độ dài tối đa 200 ký tự', async () => {
      const longNameEn = 'B'.repeat(200);
      const errors = await validateDto(BilingualNameDto, { en: longNameEn });
      assert.ok(!errors.includes('en'));
    });

    it('TC-023: Bắt lỗi khi tên tiếng Anh vượt quá 200 ký tự (201 ký tự)', async () => {
      const tooLongNameEn = 'B'.repeat(201);
      const errors = await validateDto(BilingualNameDto, { en: tooLongNameEn });
      assert.ok(errors.includes('en'));
    });

    it('TC-024: Cho phép không truyền name khi Save Draft (undefined)', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID });
      assert.ok(!errors.includes('name'));
    });

    it('TC-025: Cho phép name chỉ có tiếng Việt ({ vi: "Bia đá" })', async () => {
      const errors = await validateDto(BilingualNameDto, { vi: 'Bia đá' });
      assert.ok(!errors.includes('vi'));
      assert.ok(!errors.includes('en'));
    });

    it('TC-026: Cho phép name chỉ có tiếng Anh ({ en: "Stone Stele" })', async () => {
      const errors = await validateDto(BilingualNameDto, { en: 'Stone Stele' });
      assert.ok(!errors.includes('vi'));
      assert.ok(!errors.includes('en'));
    });

    it('TC-027: Bắt lỗi khi name.vi không phải kiểu chuỗi (số 123)', async () => {
      const errors = await validateDto(BilingualNameDto, { vi: 123 });
      assert.ok(errors.includes('vi'));
    });

    it('TC-028: Bắt lỗi khi name.en không phải kiểu chuỗi (boolean true)', async () => {
      const errors = await validateDto(BilingualNameDto, { en: true });
      assert.ok(errors.includes('en'));
    });

    it('TC-029: Cho phép truyền description dạng object song ngữ đầy đủ', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        description: { vi: 'Mô tả chi tiết', en: 'Detailed description' },
      });
      assert.ok(!errors.includes('description'));
      assert.equal(instance.description?.vi, 'Mô tả chi tiết');
      assert.equal(instance.description?.en, 'Detailed description');
    });

    it('TC-030: Tự động wrap string sang { vi: string } khi truyền description dạng chuỗi đơn', async () => {
      const { instance, errors } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        description: 'Mô tả chuỗi đơn',
      });
      assert.ok(!errors.includes('description'));
      assert.equal(instance.description?.vi, 'Mô tả chuỗi đơn');
    });

    it('TC-031: Tự động trim khoảng trắng của mô tả tiếng Việt', async () => {
      const { instance, errors } = await transformAndValidate(BilingualDescriptionDto, {
        vi: '   Mô tả có khoảng trắng thừa   ',
      });
      assert.ok(!errors.includes('vi'));
      assert.equal(instance.vi, 'Mô tả có khoảng trắng thừa');
    });

    it('TC-032: Tự động trim khoảng trắng của mô tả tiếng Anh', async () => {
      const { instance, errors } = await transformAndValidate(BilingualDescriptionDto, {
        en: '   English description with extra spaces   ',
      });
      assert.ok(!errors.includes('en'));
      assert.equal(instance.en, 'English description with extra spaces');
    });

    it('TC-033: Cho phép mô tả tiếng Việt đạt độ dài tối đa 10.000 ký tự', async () => {
      const maxDesc = 'A'.repeat(10000);
      const errors = await validateDto(BilingualDescriptionDto, { vi: maxDesc });
      assert.ok(!errors.includes('vi'));
    });

    it('TC-034: Bắt lỗi khi mô tả tiếng Việt vượt quá 10.000 ký tự (10.001 ký tự)', async () => {
      const tooLongDesc = 'A'.repeat(10001);
      const errors = await validateDto(BilingualDescriptionDto, { vi: tooLongDesc });
      assert.ok(errors.includes('vi'));
    });

    it('TC-035: Cho phép mô tả tiếng Anh đạt độ dài tối đa 10.000 ký tự', async () => {
      const maxDesc = 'B'.repeat(10000);
      const errors = await validateDto(BilingualDescriptionDto, { en: maxDesc });
      assert.ok(!errors.includes('en'));
    });

    it('TC-036: Bắt lỗi khi mô tả tiếng Anh vượt quá 10.000 ký tự (10.001 ký tự)', async () => {
      const tooLongDesc = 'B'.repeat(10001);
      const errors = await validateDto(BilingualDescriptionDto, { en: tooLongDesc });
      assert.ok(errors.includes('en'));
    });

    it('TC-037: Cho phép không truyền description khi Save Draft (undefined)', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID });
      assert.ok(!errors.includes('description'));
    });

    it('TC-038: Cho phép mô tả có chứa nhiều dòng và ký tự đặc biệt unicode', async () => {
      const richText = 'Dòng 1: Cổ vật 🏺\nDòng 2: Niên đại thế kỷ XI.';
      const errors = await validateDto(BilingualDescriptionDto, { vi: richText });
      assert.ok(!errors.includes('vi'));
    });

    it('TC-039: Bắt lỗi khi description.vi không phải kiểu chuỗi (mảng [])', async () => {
      const errors = await validateDto(BilingualDescriptionDto, { vi: [] });
      assert.ok(errors.includes('vi'));
    });

    it('TC-040: Bắt lỗi khi description.en không phải kiểu chuỗi (object {})', async () => {
      const errors = await validateDto(BilingualDescriptionDto, { en: {} });
      assert.ok(errors.includes('en'));
    });
  });

  // ===========================================================================
  // SUITE 3: 3D Transforms (Position, Rotation, Scale) Validation (20 Test Cases)
  // ===========================================================================
  describe('Suite 3: 3D Transforms Validation (20 Test Cases)', () => {
    it('TC-041: Cho phép position truyền dạng object Vector3Dto ({ x: 1.5, y: 0.8, z: -2.3 })', async () => {
      const errors = await validateDto(Vector3Dto, { x: 1.5, y: 0.8, z: -2.3 });
      assert.ok(!errors.includes('x'));
      assert.ok(!errors.includes('y'));
      assert.ok(!errors.includes('z'));
    });

    it('TC-042: Cho phép position truyền dạng phẳng positionX, positionY, positionZ', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        positionX: 2.0,
        positionY: 0.5,
        positionZ: -1.2,
      });
      assert.ok(!errors.includes('positionX'));
      assert.ok(!errors.includes('positionY'));
      assert.ok(!errors.includes('positionZ'));
    });

    it('TC-043: Khởi tạo giá trị mặc định chuẩn cho position (0, 0, 0)', async () => {
      const { instance } = await transformAndValidate(Vector3Dto, {});
      assert.equal(instance.x, 0);
      assert.equal(instance.y, 0);
      assert.equal(instance.z, 0);
    });

    it('TC-044: Helper getResolvedPosition() trích xuất đúng tọa độ từ object', async () => {
      const { instance } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        position: { x: 3.5, y: 1.2, z: -4.0 },
      });
      const pos = instance.getResolvedPosition();
      assert.deepEqual(pos, { x: 3.5, y: 1.2, z: -4.0 });
    });

    it('TC-045: Helper getResolvedPosition() trích xuất đúng tọa độ từ flat fields', async () => {
      const { instance } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        positionX: 1.1,
        positionY: 2.2,
        positionZ: 3.3,
      });
      const pos = instance.getResolvedPosition();
      assert.deepEqual(pos, { x: 1.1, y: 2.2, z: 3.3 });
    });

    it('TC-046: Bắt lỗi khi position.x là chuỗi không chuyển đổi được ("abc")', async () => {
      const errors = await validateDto(Vector3Dto, { x: 'abc' });
      assert.ok(errors.includes('x'));
    });

    it('TC-047: Bắt lỗi khi position.y là NaN', async () => {
      const errors = await validateDto(Vector3Dto, { y: NaN });
      assert.ok(errors.includes('y'));
    });

    it('TC-048: Cho phép rotation truyền dạng object Vector3Dto ({ x: 0, y: 1.57, z: 0 })', async () => {
      const errors = await validateDto(Vector3Dto, { x: 0, y: 1.57, z: 0 });
      assert.ok(!errors.includes('y'));
    });

    it('TC-049: Cho phép rotation truyền dạng phẳng rotationX, rotationY, rotationZ', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        rotationX: 0,
        rotationY: 3.14,
        rotationZ: 0,
      });
      assert.ok(!errors.includes('rotationY'));
    });

    it('TC-050: Khởi tạo giá trị mặc định chuẩn cho rotation (0, 0, 0)', async () => {
      const { instance } = await transformAndValidate(CreateExhibitDto, { roomId: VALID_UUID });
      const rot = instance.getResolvedRotation();
      assert.deepEqual(rot, { x: 0, y: 0, z: 0 });
    });

    it('TC-051: Helper getResolvedRotation() trích xuất đúng góc xoay', async () => {
      const { instance } = await transformAndValidate(CreateExhibitDto, {
        roomId: VALID_UUID,
        rotation: { x: 0.5, y: 1.0, z: 1.5 },
      });
      assert.deepEqual(instance.getResolvedRotation(), { x: 0.5, y: 1.0, z: 1.5 });
    });

    it('TC-052: Bắt lỗi khi rotation.z là chuỗi không hợp lệ', async () => {
      const errors = await validateDto(Vector3Dto, { z: 'invalid' });
      assert.ok(errors.includes('z'));
    });

    it('TC-053: Cho phép scale truyền dạng object Scale3Dto ({ x: 1, y: 1.2, z: 1 })', async () => {
      const errors = await validateDto(Scale3Dto, { x: 1, y: 1.2, z: 1 });
      assert.ok(!errors.includes('x'));
      assert.ok(!errors.includes('y'));
      assert.ok(!errors.includes('z'));
    });

    it('TC-054: Cho phép scale truyền dạng phẳng scaleX, scaleY, scaleZ', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        scaleX: 1.5,
        scaleY: 1.5,
        scaleZ: 1.5,
      });
      assert.ok(!errors.includes('scaleX'));
      assert.ok(!errors.includes('scaleY'));
      assert.ok(!errors.includes('scaleZ'));
    });

    it('TC-055: Khởi tạo giá trị mặc định chuẩn cho scale (1, 1, 1)', async () => {
      const { instance } = await transformAndValidate(Scale3Dto, {});
      assert.equal(instance.x, 1);
      assert.equal(instance.y, 1);
      assert.equal(instance.z, 1);
    });

    it('TC-056: Helper getResolvedScale() trích xuất đúng tỉ lệ mặc định', async () => {
      const { instance } = await transformAndValidate(CreateExhibitDto, { roomId: VALID_UUID });
      assert.deepEqual(instance.getResolvedScale(), { x: 1, y: 1, z: 1 });
    });

    it('TC-057: Bắt lỗi khi scale.x = 0 (scale từng trục phải > 0 theo SRS 5.2)', async () => {
      const errors = await validateDto(Scale3Dto, { x: 0 });
      assert.ok(errors.includes('x'));
    });

    it('TC-058: Bắt lỗi khi scale.y là số âm (y = -0.5)', async () => {
      const errors = await validateDto(Scale3Dto, { y: -0.5 });
      assert.ok(errors.includes('y'));
    });

    it('TC-059: Bắt lỗi khi scale.z là số âm (z = -1)', async () => {
      const errors = await validateDto(Scale3Dto, { z: -1 });
      assert.ok(errors.includes('z'));
    });

    it('TC-060: Bắt lỗi khi flat scaleX <= 0', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        scaleX: -2,
      });
      assert.ok(errors.includes('scaleX'));
    });
  });

  // ===========================================================================
  // SUITE 4: Media, Placeholders & Hotspots Validation (15 Test Cases)
  // ===========================================================================
  describe('Suite 4: Media, Placeholders & Hotspots Validation (15 Test Cases)', () => {
    it('TC-061: Cho phép placeholderShape hợp lệ ("box", "sphere", "cylinder", "cone", "torus")', async () => {
      for (const shape of ['box', 'sphere', 'cylinder', 'cone', 'torus']) {
        const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, placeholderShape: shape });
        assert.ok(!errors.includes('placeholderShape'));
      }
    });

    it('TC-062: Bắt lỗi khi placeholderShape không nằm trong danh mục ("pyramid")', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, placeholderShape: 'pyramid' });
      assert.ok(errors.includes('placeholderShape'));
    });

    it('TC-063: Cho phép placeholderColor đúng định dạng mã hex ("#8b7355", "#FFFFFF")', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, placeholderColor: '#8b7355' });
      assert.ok(!errors.includes('placeholderColor'));
    });

    it('TC-064: Bắt lỗi khi placeholderColor sai định dạng hex ("#12345", "red")', async () => {
      const errors1 = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, placeholderColor: '#12345' });
      assert.ok(errors1.includes('placeholderColor'));
      const errors2 = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, placeholderColor: 'red' });
      assert.ok(errors2.includes('placeholderColor'));
    });

    it('TC-065: Cho phép modelId, imageId, audioId là UUID v4 hợp lệ', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        modelId: VALID_UUID,
        imageId: VALID_UUID,
        audioId: VALID_UUID,
      });
      assert.ok(!errors.includes('modelId'));
      assert.ok(!errors.includes('imageId'));
      assert.ok(!errors.includes('audioId'));
    });

    it('TC-066: Bắt lỗi khi modelId sai định dạng UUID', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, modelId: 'wrong-uuid' });
      assert.ok(errors.includes('modelId'));
    });

    it('TC-067: Bắt lỗi khi imageId sai định dạng UUID', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, imageId: 'not-a-uuid' });
      assert.ok(errors.includes('imageId'));
    });

    it('TC-068: Bắt lỗi khi audioId sai định dạng UUID', async () => {
      const errors = await validateDto(CreateExhibitDto, { roomId: VALID_UUID, audioId: '123' });
      assert.ok(errors.includes('audioId'));
    });

    it('TC-069: Cho phép modelId, imageId, audioId là null (gỡ media)', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        modelId: null,
        imageId: null,
        audioId: null,
      });
      assert.ok(!errors.includes('modelId'));
      assert.ok(!errors.includes('imageId'));
      assert.ok(!errors.includes('audioId'));
    });

    it('TC-070: Cho phép transcript hợp lệ (chuỗi hoặc object)', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        transcript: { vi: 'Bài thuyết minh âm thanh' },
      });
      assert.ok(!errors.includes('transcript'));
    });

    it('TC-071: Bắt lỗi khi transcriptPlain vượt quá 20.000 ký tự (20.001 ký tự)', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        transcriptPlain: 'A'.repeat(20001),
      });
      assert.ok(errors.includes('transcriptPlain'));
    });

    it('TC-072: Cho phép altText hợp lệ (chuỗi hoặc object)', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        altText: { vi: 'Ảnh chụp mặt trước hiện vật' },
      });
      assert.ok(!errors.includes('altText'));
    });

    it('TC-073: Bắt lỗi khi altTextPlain vượt quá 240 ký tự (241 ký tự)', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        altTextPlain: 'A'.repeat(241),
      });
      assert.ok(errors.includes('altTextPlain'));
    });

    it('TC-074: Cho phép mảng hotspots chứa các phần tử CreateHotspotDto hợp lệ', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        hotspots: [
          {
            label: { vi: 'Hoa văn mặt trời' },
            positionX: 0.1,
            positionY: 0.5,
            positionZ: 0,
            displayOrder: 1,
          },
        ],
      });
      assert.ok(!errors.includes('hotspots'));
    });

    it('TC-075: Bắt lỗi khi hotspots không phải là mảng ("not-an-array")', async () => {
      const errors = await validateDto(CreateExhibitDto, {
        roomId: VALID_UUID,
        hotspots: 'not-an-array' as unknown as CreateHotspotDto[],
      });
      assert.ok(errors.includes('hotspots'));
    });
  });

  // ===========================================================================
  // SUITE 5: UpdateExhibitDto Partial Updates Validation (15 Test Cases)
  // ===========================================================================
  describe('Suite 5: UpdateExhibitDto Partial Updates Validation (15 Test Cases)', () => {
    it('TC-076: Cho phép UpdateExhibitDto là object rỗng {} (toàn bộ trường tùy chọn)', async () => {
      const errors = await validateDto(UpdateExhibitDto, {});
      assert.equal(errors.length, 0);
    });

    it('TC-077: Cho phép cập nhật riêng lẻ trường name', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        name: { vi: 'Tên cập nhật mới' },
      });
      assert.ok(!errors.includes('name'));
    });

    it('TC-078: Cho phép cập nhật riêng lẻ trường description', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        description: { vi: 'Mô tả cập nhật mới' },
      });
      assert.ok(!errors.includes('description'));
    });

    it('TC-079: Cho phép cập nhật riêng lẻ roomId sang phòng khác', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        roomId: VALID_UUID_2,
      });
      assert.ok(!errors.includes('roomId'));
    });

    it('TC-080: Cho phép cập nhật riêng lẻ position', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        position: { x: 5, y: 1, z: 2 },
      });
      assert.ok(!errors.includes('position'));
    });

    it('TC-081: Cho phép cập nhật riêng lẻ rotation', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        rotation: { x: 0, y: 1.5, z: 0 },
      });
      assert.ok(!errors.includes('rotation'));
    });

    it('TC-082: Cho phép cập nhật riêng lẻ scale', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        scale: { x: 2, y: 2, z: 2 },
      });
      assert.ok(!errors.includes('scale'));
    });

    it('TC-083: Cho phép cập nhật riêng lẻ placeholderShape', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        placeholderShape: 'cylinder',
      });
      assert.ok(!errors.includes('placeholderShape'));
    });

    it('TC-084: Cho phép cập nhật riêng lẻ placeholderColor', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        placeholderColor: '#112233',
      });
      assert.ok(!errors.includes('placeholderColor'));
    });

    it('TC-085: Cho phép cập nhật media IDs thành null để gỡ bỏ', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        modelId: null,
        imageId: null,
        audioId: null,
      });
      assert.ok(!errors.includes('modelId'));
      assert.ok(!errors.includes('imageId'));
      assert.ok(!errors.includes('audioId'));
    });

    it('TC-086: Bắt lỗi khi cập nhật scale thành số âm trong UpdateExhibitDto', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        scale: { x: -1, y: 1, z: 1 },
      });
      assert.ok(errors.includes('scale'));
    });

    it('TC-087: Bắt lỗi khi cập nhật roomId thành UUID sai trong UpdateExhibitDto', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        roomId: 'invalid-uuid',
      });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-088: Bắt lỗi khi cập nhật placeholderShape giá trị sai trong UpdateExhibitDto', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        placeholderShape: 'hexagon',
      });
      assert.ok(errors.includes('placeholderShape'));
    });

    it('TC-089: Bắt lỗi khi cập nhật displayOrder thành số âm trong UpdateExhibitDto', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        displayOrder: -5,
      });
      assert.ok(errors.includes('displayOrder'));
    });

    it('TC-090: Bắt lỗi khi cập nhật placeholderColor không phải hex trong UpdateExhibitDto', async () => {
      const errors = await validateDto(UpdateExhibitDto, {
        placeholderColor: 'invalid-color',
      });
      assert.ok(errors.includes('placeholderColor'));
    });
  });

  // ===========================================================================
  // SUITE 6: ListExhibitsQueryDto & Filters Validation (10 Test Cases)
  // ===========================================================================
  describe('Suite 6: ListExhibitsQueryDto & Filters Validation (10 Test Cases)', () => {
    it('TC-091: Khởi tạo giá trị mặc định phân trang (page = 1, pageSize = 20, skip = 0)', async () => {
      const { instance, errors } = await transformAndValidate(ListExhibitsQueryDto, {});
      assert.equal(errors.length, 0);
      assert.equal(instance.page, 1);
      assert.equal(instance.pageSize, 20);
      assert.equal(instance.skip, 0);
    });

    it('TC-092: Cho phép lọc theo status = "draft"', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { status: 'draft' });
      assert.ok(!errors.includes('status'));
    });

    it('TC-093: Cho phép lọc theo status = "published"', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { status: 'published' });
      assert.ok(!errors.includes('status'));
    });

    it('TC-094: Cho phép lọc theo status = "all"', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { status: 'all' });
      assert.ok(!errors.includes('status'));
    });

    it('TC-095: Bắt lỗi khi lọc status giá trị không hợp lệ ("archived")', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { status: 'archived' });
      assert.ok(errors.includes('status'));
    });

    it('TC-096: Cho phép lọc theo roomId là UUID hợp lệ', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { roomId: VALID_UUID });
      assert.ok(!errors.includes('roomId'));
    });

    it('TC-097: Bắt lỗi khi roomId trong query không phải UUID', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { roomId: 'not-a-uuid' });
      assert.ok(errors.includes('roomId'));
    });

    it('TC-098: Cho phép lọc theo visibility = "visible" hoặc "hidden"', async () => {
      const errors1 = await validateDto(ListExhibitsQueryDto, { visibility: ExhibitVisibility.VISIBLE });
      assert.ok(!errors1.includes('visibility'));
      const errors2 = await validateDto(ListExhibitsQueryDto, { visibility: ExhibitVisibility.HIDDEN });
      assert.ok(!errors2.includes('visibility'));
    });

    it('TC-099: Bắt lỗi khi visibility giá trị lạ ("public")', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { visibility: 'public' });
      assert.ok(errors.includes('visibility'));
    });

    it('TC-100: Cho phép tìm kiếm q và sắp xếp sort ("name:asc")', async () => {
      const errors = await validateDto(ListExhibitsQueryDto, { q: 'trống đồng', sort: 'createdAt:desc' });
      assert.ok(!errors.includes('q'));
      assert.ok(!errors.includes('sort'));
    });
  });

  // ===========================================================================
  // SUITE 7: Publication Validation Rules (SRS Mục 5.2 - 20 Test Cases)
  // ===========================================================================
  describe('Suite 7: Publication Validation Rules (SRS Mục 5.2 - 20 Test Cases)', () => {
    const validPublishPayload = {
      name: { vi: 'Trống đồng Cảnh Thịnh', en: 'Canh Thinh Bronze Drum' },
      description: {
        vi: 'Hiện vật thời Tây Sơn, đúc năm 1800.',
        en: 'Artifact from Tay Son period, cast in 1800.',
      },
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };

    it('TC-101: Cho phép Publish thành công khi đầy đủ tất cả thông tin hợp lệ', () => {
      const result = validateForPublish(validPublishPayload);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
    });

    it('TC-102: Bắt lỗi khi thiếu name.vi khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        name: { en: 'Drum' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('name.vi')));
    });

    it('TC-103: Bắt lỗi khi name.vi là chuỗi rỗng sau khi trim ("   ") khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        name: { vi: '   ', en: 'Drum' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('name.vi')));
    });

    it('TC-104: Bắt lỗi khi thiếu name.en khi publish (bắt buộc song ngữ)', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        name: { vi: 'Trống đồng' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('name.en')));
    });

    it('TC-105: Bắt lỗi khi name.en là chuỗi rỗng sau khi trim ("   ") khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        name: { vi: 'Trống đồng', en: '   ' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('name.en')));
    });

    it('TC-106: Bắt lỗi khi name.vi vượt quá 200 ký tự khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        name: { vi: 'A'.repeat(201), en: 'Drum' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('name.vi')));
    });

    it('TC-107: Bắt lỗi khi name.en vượt quá 200 ký tự khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        name: { vi: 'Trống đồng', en: 'B'.repeat(201) },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('name.en')));
    });

    it('TC-108: Bắt lỗi khi thiếu description.vi khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        description: { en: 'Desc' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('description.vi')));
    });

    it('TC-109: Bắt lỗi khi description.vi rỗng sau trim khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        description: { vi: '   ', en: 'Desc' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('description.vi')));
    });

    it('TC-110: Bắt lỗi khi thiếu description.en khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        description: { vi: 'Mô tả' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('description.en')));
    });

    it('TC-111: Bắt lỗi khi description.en rỗng sau trim khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        description: { vi: 'Mô tả', en: '   ' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('description.en')));
    });

    it('TC-112: Bắt lỗi khi description.vi vượt quá 10.000 ký tự khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        description: { vi: 'A'.repeat(10001), en: 'Desc' },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('description.vi')));
    });

    it('TC-113: Bắt lỗi khi description.en vượt quá 10.000 ký tự khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        description: { vi: 'Mô tả', en: 'B'.repeat(10001) },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('description.en')));
    });

    it('TC-114: Bắt lỗi khi scale.x <= 0 khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        scale: { x: 0, y: 1, z: 1 },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('scale')));
    });

    it('TC-115: Bắt lỗi khi scale.y <= 0 khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        scale: { x: 1, y: -0.1, z: 1 },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('scale')));
    });

    it('TC-116: Bắt lỗi khi scale.z <= 0 khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        scale: { x: 1, y: 1, z: 0 },
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('scale')));
    });

    it('TC-117: Bắt lỗi khi có audioId nhưng thiếu transcript khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        audioId: VALID_UUID,
        transcript: null,
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('transcript')));
    });

    it('TC-118: Bắt lỗi khi có audioId nhưng transcript chỉ gồm khoảng trắng khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        audioId: VALID_UUID,
        transcript: '   ',
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('transcript')));
    });

    it('TC-119: Bắt lỗi khi có imageId nhưng thiếu altText.vi hoặc altText.en khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        imageId: VALID_UUID,
        altText: { vi: 'Ảnh hiện vật' }, // thiếu en
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('altText.en')));
    });

    it('TC-120: Bắt lỗi khi hotspot trong danh sách thiếu tiêu đề hoặc nội dung song ngữ khi publish', () => {
      const result = validateForPublish({
        ...validPublishPayload,
        hotspots: [
          {
            label: { vi: 'Điểm chạm 1' }, // thiếu en
            body: { vi: 'Nội dung', en: 'Content' },
          },
        ],
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('hotspots[0].label.en')));
    });
  });

  // ===========================================================================
  // SUITE 8: ExhibitResponseDto & An Toàn Dữ Liệu (10 Test Cases)
  // ===========================================================================
  describe('Suite 8: ExhibitResponseDto & An Toàn Dữ Liệu (10 Test Cases)', () => {
    function createMockExhibit(overrides: Partial<Exhibit> = {}): Exhibit {
      const exhibit = new Exhibit();
      exhibit.id = VALID_UUID;
      exhibit.roomId = VALID_UUID_2;
      exhibit.visibility = ExhibitVisibility.VISIBLE;
      exhibit.version = 1;
      exhibit.displayOrder = 2;
      exhibit.publishedRevisionId = 'revision-uuid-1';
      exhibit.isDeleted = false;
      exhibit.deletedAt = null;
      exhibit.createdAt = new Date('2026-10-10T10:00:00Z');
      exhibit.updatedAt = new Date('2026-10-10T12:00:00Z');
      return Object.assign(exhibit, overrides);
    }

    function createMockRevision(overrides: Partial<ExhibitRevision> = {}): ExhibitRevision {
      const rev = new ExhibitRevision();
      rev.id = 'revision-uuid-1';
      rev.exhibitId = VALID_UUID;
      rev.revisionNo = 1;
      rev.state = RevisionState.APPROVED;
      rev.content = {
        name: 'Trống đồng',
        description: 'Mô tả trống đồng',
        position: { x: 1, y: 2, z: 3 },
      };
      rev.hotspots = [];
      return Object.assign(rev, overrides);
    }

    it('TC-121: Map đúng trạng thái "published" khi có publishedRevisionId và visibility = "visible"', () => {
      const entity = createMockExhibit({
        publishedRevisionId: 'rev-1',
        visibility: ExhibitVisibility.VISIBLE,
      });
      const rev = createMockRevision();
      const res = ExhibitResponseDto.fromEntity(entity, rev);
      assert.equal(res.status, 'published');
    });

    it('TC-122: Map đúng trạng thái "draft" khi chưa có publishedRevisionId', () => {
      const entity = createMockExhibit({
        publishedRevisionId: null,
      });
      const rev = createMockRevision();
      const res = ExhibitResponseDto.fromEntity(entity, rev);
      assert.equal(res.status, 'draft');
    });

    it('TC-123: Map đúng trạng thái "draft" khi có revisionId nhưng visibility = "hidden"', () => {
      const entity = createMockExhibit({
        publishedRevisionId: 'rev-1',
        visibility: ExhibitVisibility.HIDDEN,
      });
      const rev = createMockRevision();
      const res = ExhibitResponseDto.fromEntity(entity, rev);
      assert.equal(res.status, 'draft');
    });

    it('TC-124: Trích xuất đúng số lượng hotspotsCount từ relation', () => {
      const entity = createMockExhibit();
      const hs1 = new Hotspot();
      hs1.id = 'hs-1';
      const hs2 = new Hotspot();
      hs2.id = 'hs-2';
      const rev = createMockRevision({
        hotspots: [hs1, hs2],
      });
      const res = ExhibitResponseDto.fromEntity(entity, rev);
      assert.equal(res.hotspotsCount, 2);
    });

    it('TC-125: Gán hotspotsCount = 0 khi không có hotspots', () => {
      const entity = createMockExhibit();
      const rev = createMockRevision({ hotspots: [] });
      const res = ExhibitResponseDto.fromEntity(entity, rev);
      assert.equal(res.hotspotsCount, 0);
    });

    it('TC-126: Bảo toàn đúng định dạng UUID của id và roomId', () => {
      const entity = createMockExhibit();
      const res = ExhibitResponseDto.fromEntity(entity, null);
      assert.equal(res.id, VALID_UUID);
      assert.equal(res.roomId, VALID_UUID_2);
    });

    it('TC-127: Bảo toàn đúng các đối tượng Date cho createdAt và updatedAt', () => {
      const entity = createMockExhibit();
      const res = ExhibitResponseDto.fromEntity(entity, null);
      assert.ok(res.createdAt instanceof Date);
      assert.ok(res.updatedAt instanceof Date);
    });

    it('TC-128: Map đúng revisionNo và revisionState của activeRevision', () => {
      const entity = createMockExhibit();
      const rev = createMockRevision({ revisionNo: 3, state: RevisionState.DRAFT });
      const res = ExhibitResponseDto.fromEntity(entity, rev);
      assert.equal(res.currentRevisionNo, 3);
      assert.equal(res.revisionState, RevisionState.DRAFT);
    });

    it('TC-129: Hàm toExhibitResponse() trả về kết quả khớp với ExhibitResponseDto.fromEntity()', () => {
      const entity = createMockExhibit();
      const rev = createMockRevision();
      const res1 = toExhibitResponse(entity, rev);
      const res2 = ExhibitResponseDto.fromEntity(entity, rev);
      assert.deepEqual(res1, res2);
    });

    it('TC-130: An toàn dữ liệu — không rò rỉ các trường nội bộ isDeleted và deletedAt ra ngoài response', () => {
      const entity = createMockExhibit();
      const res = ExhibitResponseDto.fromEntity(entity, null) as unknown as Record<string, unknown>;
      assert.equal(res['isDeleted'], undefined);
      assert.equal(res['deletedAt'], undefined);
    });
  });
});
