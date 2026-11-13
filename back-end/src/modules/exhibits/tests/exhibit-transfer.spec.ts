import 'reflect-metadata';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, NotFoundException, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import { CSV_BOM, parseCsv } from '../../../common/utils/csv.util';
import type { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import type { CreateExhibitDto } from '../dto/create-exhibit.dto';
import type { ExhibitAdminResponse } from '../dto/exhibit-response.dto';
import { ExhibitVisibility } from '../entities/exhibit.entity';
import { RevisionState } from '../entities/exhibit-revision.entity';
import { TRANSFER_COLUMNS } from '../services/exhibit-transfer.columns';
import { EXPORT_MAX_ROWS, ExhibitTransferService, IMPORT_MAX_ROWS } from '../services/exhibit-transfer.service';
import type { ExhibitsService } from '../services/exhibits.service';

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ROOM_ID = '22222222-2222-4222-8222-222222222222';
const DELETED_ROOM_ID = '33333333-3333-4333-8333-333333333333';
const MODEL_ID = '44444444-4444-4444-8444-444444444444';
const USER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };

function exhibit(overrides: Partial<ExhibitAdminResponse> = {}, content: Partial<ExhibitAdminResponse['content']> = {}): ExhibitAdminResponse {
  return {
    id: 'e0000000-0000-4000-8000-000000000001',
    roomId: ROOM_ID,
    status: 'draft',
    visibility: ExhibitVisibility.HIDDEN,
    version: 1,
    displayOrder: 3,
    publishedRevisionId: null,
    currentRevisionNo: 2,
    revisionState: RevisionState.DRAFT,
    content: {
      name: { vi: 'Bình gốm, men lam', en: 'Blue "glazed" jar', ja: '青釉の壺' },
      description: 'Mô tả cũ dạng chuỗi\ncó xuống dòng',
      position: { x: -4, y: 0, z: 2.5 },
      rotation: { x: 0, y: 1.57, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      placeholderShape: 'cylinder',
      placeholderColor: '#647552',
      transcript: { vi: '=HYPERLINK("http://evil")', en: '' },
      altText: { vi: 'Ảnh bình gốm' },
      modelId: MODEL_ID,
      imageId: null,
      audioId: null,
      ...content,
    },
    hotspotsCount: 0,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-02T00:00:00Z'),
    ...overrides,
  };
}

class FakeExhibitsService {
  items: ExhibitAdminResponse[] = [];
  created: CreateExhibitDto[] = [];
  queries: Array<Record<string, unknown>> = [];
  /** Ném lỗi ở lần gọi `createExhibitDraft` thứ n (1-based) để giả lập lỗi media/DB của một dòng. */
  failOn = new Map<number, Error>();
  attempts = 0;

  async searchAdminExhibits(query: { page?: number; pageSize?: number } & Record<string, unknown>) {
    this.queries.push({ ...query });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return { items: this.items.slice((page - 1) * pageSize, page * pageSize), total: this.items.length, page, pageSize };
  }

  async createExhibitDraft(dto: CreateExhibitDto) {
    this.attempts += 1;
    const failure = this.failOn.get(this.attempts);
    if (failure) throw failure;
    this.created.push(dto);
    return { id: `c0000000-0000-4000-8000-${String(this.attempts).padStart(12, '0')}` } as ExhibitAdminResponse;
  }
}

class FakeRoomsRepository {
  rooms = [
    { id: ROOM_ID, slug: 'phong-gom', isDeleted: false },
    { id: OTHER_ROOM_ID, slug: 'phong-dong', isDeleted: false },
    { id: DELETED_ROOM_ID, slug: 'phong-cu', isDeleted: true },
  ];
  slugLookups = 0;
  async findById(id: string) {
    return this.rooms.find((room) => room.id === id) ?? null;
  }
  async findBySlug(slug: string) {
    this.slugLookups += 1;
    return this.rooms.find((room) => room.slug === slug && !room.isDeleted) ?? null;
  }
}

const csvFile = (text: string, name = 'hien-vat.csv') => ({ buffer: Buffer.from(text, 'utf8'), originalname: name });
const jsonFile = (data: unknown, name = 'hien-vat.json') => ({ buffer: Buffer.from(JSON.stringify(data), 'utf8'), originalname: name });

describe('ExhibitTransferService (Task 38)', () => {
  let exhibits: FakeExhibitsService;
  let rooms: FakeRoomsRepository;
  let service: ExhibitTransferService;

  beforeEach(() => {
    exhibits = new FakeExhibitsService();
    rooms = new FakeRoomsRepository();
    service = new ExhibitTransferService(exhibits as unknown as ExhibitsService, rooms as unknown as RoomsRepository);
  });

  // ------------------------------------------------------------------ xuất
  describe('xuất', () => {
    it('CSV: BOM, tiêu đề đúng thứ tự cột, giá trị phẳng theo locale/trục', async () => {
      exhibits.items = [exhibit()];
      const csv = await service.export({}, 'csv');
      assert.ok(csv.startsWith(CSV_BOM));
      const [header, row] = parseCsv(csv);
      assert.deepEqual(header, [...TRANSFER_COLUMNS]);
      const record = Object.fromEntries(header.map((column, i) => [column, row[i]]));
      assert.equal(record.roomSlug, 'phong-gom');
      assert.equal(record.name_vi, 'Bình gốm, men lam');
      assert.equal(record.name_en, 'Blue "glazed" jar');
      assert.equal(record.name_ja, '青釉の壺');
      assert.equal(record.description_vi, 'Mô tả cũ dạng chuỗi\ncó xuống dòng', 'nội dung chuỗi cũ → cột tiếng Việt');
      assert.equal(record.positionX, '-4', 'cột số không bị thêm dấu chống công thức');
      assert.equal(record.rotationY, '1.57');
      assert.equal(record.modelId, MODEL_ID);
      assert.equal(record.transcript_vi, `'=HYPERLINK("http://evil")`, 'cột văn bản bắt đầu bằng = được chống CSV injection');
      assert.equal(record.status, 'draft');
      assert.equal(record.revisionState, 'draft');
    });

    it('JSON: { exportedAt, count, items } với cùng khóa phẳng', async () => {
      exhibits.items = [exhibit(), exhibit({ id: 'e2', roomId: OTHER_ROOM_ID })];
      const json = JSON.parse(await service.export({}, 'json'));
      assert.equal(json.count, 2);
      assert.ok(!Number.isNaN(Date.parse(json.exportedAt)));
      assert.deepEqual(Object.keys(json.items[0]).sort(), [...TRANSFER_COLUMNS].sort());
      assert.equal(json.items[1].roomSlug, 'phong-dong');
      assert.equal(json.items[0].transcript_vi, '=HYPERLINK("http://evil")', 'JSON không cần (và không được) thêm dấu chống công thức');
    });

    it('đọc hết mọi trang, giữ bộ lọc, luôn loại thùng rác', async () => {
      exhibits.items = Array.from({ length: 230 }, (_, i) => exhibit({ id: `e${i}` }));
      const csv = await service.export({ roomId: ROOM_ID, status: 'draft' }, 'csv');
      assert.equal(parseCsv(csv).length, 231);
      assert.equal(exhibits.queries.length, 3);
      for (const query of exhibits.queries) {
        assert.equal(query.roomId, ROOM_ID);
        assert.equal(query.status, 'draft');
        assert.equal(query.deleted, false);
      }
    });

    it(`quá ${EXPORT_MAX_ROWS} hiện vật → 400 yêu cầu lọc theo phòng`, async () => {
      exhibits.items = Array.from({ length: EXPORT_MAX_ROWS + 1 }, (_, i) => exhibit({ id: `e${i}` }));
      await assert.rejects(service.export({}, 'csv'), (error: unknown) => error instanceof BadRequestException && /lọc theo phòng/.test(error.message));
    });

    it('không có hiện vật → CSV chỉ có tiêu đề', async () => {
      assert.equal(parseCsv(await service.export({}, 'csv')).length, 1);
    });
  });

  // ------------------------------------------------------------------ round-trip
  describe('xuất rồi nhập lại (round-trip)', () => {
    it('CSV: nhập file vừa xuất tạo bản nháp có cùng nội dung', async () => {
      exhibits.items = [exhibit()];
      const csv = await service.export({}, 'csv');
      const result = await service.import(csvFile(csv), false, USER);
      assert.equal(result.created, 1, JSON.stringify(result.rows));
      const [dto] = exhibits.created;
      assert.equal(dto.roomId, ROOM_ID);
      assert.equal(dto.displayOrder, 3);
      // So theo JSON: DTO khai báo sẵn các locale = undefined, JSONB lưu sẽ bỏ các khóa đó.
      assert.deepEqual(JSON.parse(JSON.stringify(dto.name)), { vi: 'Bình gốm, men lam', en: 'Blue "glazed" jar', ja: '青釉の壺' });
      assert.equal(dto.description?.vi, 'Mô tả cũ dạng chuỗi\ncó xuống dòng');
      assert.equal(dto.transcript?.vi, '=HYPERLINK("http://evil")', 'dấu chống công thức được bỏ khi nhập');
      assert.equal(dto.positionX, -4);
      assert.equal(dto.positionZ, 2.5);
      assert.equal(dto.rotationY, 1.57);
      assert.equal(dto.placeholderShape, 'cylinder');
      assert.equal(dto.placeholderColor, '#647552');
      assert.equal(dto.modelId, MODEL_ID);
    });

    it('JSON: nhập file vừa xuất cũng tạo được (dạng { items })', async () => {
      exhibits.items = [exhibit()];
      const json = await service.export({}, 'json');
      const result = await service.import({ buffer: Buffer.from(json), originalname: 'x.json' }, false, USER);
      assert.equal(result.created, 1, JSON.stringify(result.rows));
      assert.equal(exhibits.created[0].transcript?.vi, '=HYPERLINK("http://evil")');
    });
  });

  // ------------------------------------------------------------------ nhập
  describe('nhập theo dòng', () => {
    const header = 'roomSlug,name_vi,name_en,displayOrder,positionX,placeholderColor';

    it('dryRun: kiểm tra mọi dòng, KHÔNG tạo gì, không trả id (không ghi audit)', async () => {
      const result = await service.import(csvFile(`${header}\nphong-gom,Bình,Jar,1,-2,#112233\nphong-dong,Chuông,,2,0,`), true, USER);
      assert.deepEqual(
        { dryRun: result.dryRun, total: result.total, valid: result.valid, created: result.created, failed: result.failed, ids: result.ids },
        { dryRun: true, total: 2, valid: 2, created: 0, failed: 0, ids: [] },
      );
      assert.deepEqual(result.rows.map((r) => r.status), ['valid', 'valid']);
      assert.equal(exhibits.created.length, 0);
    });

    it('thành công một phần: dòng lỗi được báo theo trường, dòng đúng vẫn được tạo', async () => {
      const result = await service.import(
        csvFile([
          header,
          'phong-gom,Bình hợp lệ,,1,0,#112233',
          'phong-khong-co,Sai phòng,,1,0,',
          'phong-gom,Màu sai,,1,0,xanh',
          'phong-gom,Thứ tự âm,,-1,0,',
          'phong-gom,Tọa độ chữ,,1,abc,',
          `phong-gom,${'x'.repeat(201)},,1,0,`,
          'phong-cu,Phòng đã xóa,,1,0,',
          'phong-gom,Hợp lệ 2,,,,',
        ].join('\n')),
        false,
        USER,
      );
      assert.equal(result.total, 8);
      assert.equal(result.created, 2);
      assert.equal(result.failed, 6);
      assert.equal(result.ids.length, 2);
      const byRow = new Map(result.rows.map((r) => [r.row, r]));
      assert.equal(byRow.get(1)?.status, 'created');
      assert.match(byRow.get(1)!.exhibitId!, /^c0000000/);
      assert.deepEqual(byRow.get(2)?.errors.map((e) => e.field), ['roomSlug']);
      assert.equal(byRow.get(3)?.errors[0].field, 'placeholderColor');
      assert.equal(byRow.get(4)?.errors[0].field, 'displayOrder');
      assert.equal(byRow.get(5)?.errors[0].field, 'positionX');
      assert.equal(byRow.get(6)?.errors[0].field, 'name.vi');
      assert.deepEqual(byRow.get(7)?.errors.map((e) => e.field), ['roomSlug'], 'phòng đã xóa mềm coi như không tồn tại');
      assert.equal(byRow.get(8)?.status, 'created');
      assert.equal(byRow.get(2)?.name, 'Sai phòng');
      assert.ok(result.rows.every((r) => r.status !== 'error' || r.errors.every((e) => e.message.length > 0)));
    });

    it('lỗi khi tạo (vd media không gắn được) → lỗi của dòng đó, các dòng sau vẫn chạy', async () => {
      exhibits.failOn.set(2, new BadRequestException('Media không tồn tại hoặc chưa sẵn sàng'));
      exhibits.failOn.set(3, new Error('kết nối DB bị ngắt'));
      const result = await service.import(csvFile(`${header}\nphong-gom,A,,,,\nphong-gom,B,,,,\nphong-gom,C,,,,\nphong-gom,D,,,,`), false, USER);
      assert.deepEqual(result.rows.map((r) => r.status), ['created', 'error', 'error', 'created']);
      assert.equal(result.rows[1].errors[0].message, 'Media không tồn tại hoặc chưa sẵn sàng');
      assert.match(result.rows[2].errors[0].message, /Lỗi không xác định/, 'không lộ chi tiết lỗi nội bộ ra client');
      assert.equal(result.created, 2);
    });

    it('roomId thay cho roomSlug; roomId và roomSlug lệch nhau → lỗi', async () => {
      const result = await service.import(
        csvFile(`roomId,roomSlug,name_vi\n${ROOM_ID},,Theo id\n${ROOM_ID},phong-dong,Lệch\nkhong-phai-uuid,,Sai định dạng\n${DELETED_ROOM_ID},,Phòng xóa\n,,Thiếu phòng`),
        true,
        USER,
      );
      assert.deepEqual(result.rows.map((r) => r.status), ['valid', 'error', 'error', 'error', 'error']);
      assert.equal(result.rows[1].errors[0].field, 'roomId');
      assert.equal(result.rows[2].errors[0].field, 'roomId');
      assert.match(result.rows[2].errors[0].message, /UUID/);
      assert.match(result.rows[3].errors[0].message, /Không tìm thấy phòng/);
      assert.deepEqual(result.rows[4].errors.map((e) => e.message), ['Cần roomSlug hoặc roomId'], 'không lặp thêm lỗi "roomId trống" của DTO');
    });

    it('cột chỉ đọc (id, status, visibility, revisionState) bị bỏ qua, không ghi đè hiện vật cũ', async () => {
      const result = await service.import(csvFile(`id,status,visibility,revisionState,roomSlug,name_vi\nxxx,published,visible,approved,phong-gom,A`), false, USER);
      assert.equal(result.created, 1, JSON.stringify(result.rows));
      const dto = exhibits.created[0] as unknown as Record<string, unknown>;
      for (const key of ['id', 'status', 'visibility', 'revisionState']) assert.equal(dto[key], undefined, key);
    });

    it('dòng thừa ô so với tiêu đề → lỗi dòng (dấu phẩy chưa bọc nháy), không nhập lệch cột', async () => {
      const result = await service.import(csvFile(`roomSlug,name_vi\nphong-gom,Bình, men lam`), false, USER);
      assert.equal(result.rows[0].status, 'error');
      assert.match(result.rows[0].errors[0].message, /3 ô nhưng tiêu đề chỉ có 2 cột/);
      assert.equal(exhibits.created.length, 0);
    });

    it('dòng thiếu ô cuối được coi là ô trống', async () => {
      const result = await service.import(csvFile(`roomSlug,name_vi,name_en\nphong-gom,Bình`), true, USER);
      assert.equal(result.rows[0].status, 'valid');
    });

    it('tra phòng theo slug một lần cho nhiều dòng (cache)', async () => {
      const lines = Array.from({ length: 50 }, (_, i) => `phong-gom,Hiện vật ${i}`);
      await service.import(csvFile(`roomSlug,name_vi\n${lines.join('\n')}`), true, USER);
      assert.equal(rooms.slugLookups, 1);
    });

    it('JSON: mảng phẳng, số và null được chấp nhận', async () => {
      const result = await service.import(jsonFile([{ roomSlug: 'phong-gom', name_vi: 'A', positionX: -1.5, imageId: null }]), false, USER);
      assert.equal(result.created, 1, JSON.stringify(result.rows));
      assert.equal(exhibits.created[0].positionX, -1.5);
    });

    it('nhận diện JSON theo nội dung khi đuôi file không phải .json', async () => {
      const result = await service.import({ buffer: Buffer.from('[{"roomSlug":"phong-gom","name_vi":"A"}]'), originalname: 'du-lieu.txt' }, true, USER);
      assert.equal(result.valid, 1);
    });
  });

  // ------------------------------------------------------------------ lỗi cấp file
  describe('lỗi cấp file (không xử lý dòng nào)', () => {
    const rejects422 = async (file: { buffer: Buffer; originalname?: string }, pattern: RegExp) => {
      await assert.rejects(service.import(file, false, USER), (error: unknown) => {
        assert.ok(error instanceof UnprocessableEntityException, String(error));
        const body = error.getResponse() as { message: string; errors: Array<{ field: string; code: string }> };
        assert.match(body.message, pattern);
        assert.equal(body.errors[0].field, 'file');
        assert.equal(body.errors[0].code, 'exhibit_import_invalid_file');
        return true;
      });
      assert.equal(exhibits.created.length, 0);
    };

    it('thiếu file → 400', async () => {
      await assert.rejects(service.import(undefined, false, USER), BadRequestException);
    });
    it('file rỗng / chỉ BOM và khoảng trắng → 422', () => rejects422(csvFile(`${CSV_BOM}  \n `), /File rỗng/));
    it('không phải UTF-8 → 422', () => rejects422({ buffer: Buffer.from([0xff, 0xfe, 0x41, 0x00]), originalname: 'a.csv' }, /UTF-8/));
    it('chỉ có tiêu đề → 422 không có dòng dữ liệu', () => rejects422(csvFile('roomSlug,name_vi\n'), /không có dòng dữ liệu/));
    it('cột lạ → 422 liệt kê cột', () => rejects422(csvFile('roomSlug,ten,giaBan\nphong-gom,a,1'), /Cột không được hỗ trợ: ten, giaBan/));
    it('thiếu cả roomSlug lẫn roomId → 422', () => rejects422(csvFile('name_vi\nA'), /roomSlug hoặc roomId/));
    it('cột lặp → 422', () => rejects422(csvFile('roomSlug,name_vi,name_vi\nphong-gom,a,b'), /Cột bị lặp: name_vi/));
    it('CSV nháy không đóng → 422 kèm số dòng', () => rejects422(csvFile('roomSlug,name_vi\nphong-gom,"chưa đóng'), /Dòng 2/));
    it(`quá ${IMPORT_MAX_ROWS} dòng → 422`, () =>
      rejects422(csvFile(`roomSlug,name_vi\n${Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => 'phong-gom,a').join('\n')}`), /tối đa 500 dòng/));
    it('JSON hỏng → 422', () => rejects422({ buffer: Buffer.from('[{"a":'), originalname: 'a.json' }, /JSON không hợp lệ/));
    it('JSON không phải mảng/items → 422', () => rejects422(jsonFile({ data: [] }), /phải là mảng/));
    it('JSON phần tử không phải object → 422', () => rejects422(jsonFile([1, 2]), /Phần tử thứ 1/));
    it('JSON giá trị lồng nhau → 422', () => rejects422(jsonFile([{ roomSlug: 'phong-gom', name_vi: { a: 1 } }]), /chỉ nhận chuỗi, số hoặc null/));

    it('> 2 MB → 413', async () => {
      await assert.rejects(service.import({ buffer: Buffer.alloc(2_000_001, 0x61), originalname: 'a.csv' }, false, USER), PayloadTooLargeException);
    });

    it('đúng 500 dòng vẫn được nhận', async () => {
      const result = await service.import(csvFile(`roomSlug,name_vi\n${Array.from({ length: IMPORT_MAX_ROWS }, () => 'phong-gom,a').join('\n')}`), true, USER);
      assert.equal(result.total, IMPORT_MAX_ROWS);
    });
  });

  it('NotFoundException từ service hiển thị message gốc (tiếng Việt)', async () => {
    exhibits.failOn.set(1, new NotFoundException('Không tìm thấy phòng trưng bày'));
    const result = await service.import(csvFile('roomSlug,name_vi\nphong-gom,A'), false, USER);
    assert.equal(result.rows[0].errors[0].message, 'Không tìm thấy phòng trưng bày');
  });
});
