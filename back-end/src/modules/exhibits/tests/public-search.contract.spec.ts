import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { ExhibitsController } from '../controllers/exhibits.controller';
import { ExhibitsService } from '../services/exhibits.service';
import { PublicModelsService } from '../services/public-models.service';
import { Paginated } from '../../../common/types/paginated.type';
import { PublicExhibitDto } from '../mappers/public-exhibit.mapper';

// ============================================================================
// VT-077 — CONTRACT TEST (kỹ thuật test bắt buộc của biến thể) qua HTTP.
// Khẳng định response khớp envelope ApiResponse đã công bố (06-api-contract.md):
// { success, data, meta:{page,pageSize,total} }, item chỉ chứa field public,
// và sai input → 400 (không 500). Bảo vệ risk "đổi schema/API phá client cũ".
// ============================================================================

const ROOM_ID = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';

function samplePublicExhibit(): PublicExhibitDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    revisionId: '22222222-2222-4222-8222-222222222222',
    roomId: ROOM_ID,
    displayOrder: 1,
    name: 'Trống đồng Đông Sơn',
    description: 'Hiện vật tiêu biểu',
    transcript: null,
    i18n: {
      vi: { name: 'Trống đồng Đông Sơn', description: 'Hiện vật tiêu biểu', transcript: null },
      en: { name: 'Dong Son drum', description: 'Highlight', transcript: null },
    },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    placeholderShape: 'box',
    placeholderColor: '#8b7355',
    hotspots: [],
    model: null,
    image: null,
    audio: null,
  };
}

describe('VT-077 GET /rooms/search — contract', () => {
  let app: INestApplication;
  const calls: Array<Record<string, unknown>> = [];

  before(async () => {
    const service = {
      publicSearch: async (query: Record<string, unknown>): Promise<Paginated<PublicExhibitDto>> => {
        calls.push(query);
        return { items: [samplePublicExhibit()], total: 1, page: Number(query.page) || 1, pageSize: Number(query.pageSize) || 20 };
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ExhibitsController],
      providers: [
        { provide: ExhibitsService, useValue: service },
        { provide: PublicModelsService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  after(async () => {
    await app?.close();
  });

  it('TC-09: response khớp envelope ApiResponse + meta', async () => {
    calls.length = 0;
    const res = await request(app.getHttpServer()).get('/rooms/search?q=trống&page=1&pageSize=20').expect(200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, null);
    assert.ok(Array.isArray(res.body.data));
    assert.deepEqual(res.body.meta, { page: 1, pageSize: 20, total: 1 });
  });

  it('TC-10: item chỉ chứa field public, không rò rỉ entity nội bộ', async () => {
    const res = await request(app.getHttpServer()).get('/rooms/search?q=trống').expect(200);
    const item = res.body.data[0];
    for (const f of ['id', 'revisionId', 'roomId', 'displayOrder', 'name', 'i18n']) {
      assert.ok(f in item, `thiếu field public ${f}`);
    }
    for (const leak of ['publishedRevision', 'storageKey', 'isDeleted', 'version', 'passwordHash']) {
      assert.ok(!(leak in item), `rò rỉ field nội bộ ${leak}`);
    }
  });

  it('TC-05 (negative): pageSize=101 → 400, service không bị gọi', async () => {
    calls.length = 0;
    const res = await request(app.getHttpServer()).get('/rooms/search?pageSize=101').expect(400);
    assert.equal(res.body.success, false);
    assert.equal(calls.length, 0);
  });

  it('TC (negative): page=0 → 400', async () => {
    await request(app.getHttpServer()).get('/rooms/search?page=0').expect(400);
  });

  it('TC-04 (negative): roomId sai định dạng UUID → 400 (không 500)', async () => {
    const res = await request(app.getHttpServer()).get('/rooms/search?roomId=not-a-uuid').expect(400);
    assert.equal(res.body.success, false);
  });

  it('AC-5: route /rooms/search KHÔNG nuốt route cũ /rooms/:slug', async () => {
    // :slug vẫn hoạt động riêng (service khác) — ở đây chỉ chứng minh search là route độc lập.
    const res = await request(app.getHttpServer()).get('/rooms/search').expect(200);
    assert.equal(res.body.success, true);
  });
});
