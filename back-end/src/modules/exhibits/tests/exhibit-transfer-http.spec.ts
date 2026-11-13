import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { CanActivate, ExecutionContext, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { AuthUser } from '../../../common/types/auth-user.type';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor';
import { AuditService } from '../../audit/services/audit.service';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { AdminExhibitTransferController } from '../controllers/admin-exhibit-transfer.controller';
import { AdminExhibitsController } from '../controllers/admin-exhibits.controller';
import { ExhibitsModule } from '../exhibits.module';
import { ExhibitTransferService } from '../services/exhibit-transfer.service';
import { ExhibitsService } from '../services/exhibits.service';

/**
 * Task 38 — xuất/nhập qua HTTP thật: multipart → UploadFileInterceptor → ExhibitTransferService thật,
 * ExhibitsService/RoomsRepository là fake. Kiểm tra thứ tự route, envelope lỗi, quyền và audit.
 */
const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const EDITOR: AuthUser = {
  id: 'b0000000-0000-4000-8000-000000000002',
  email: 'editor@example.test',
  displayName: 'Editor',
  roles: ['editor'],
  permissions: [PERMISSIONS.EXHIBIT_READ, PERMISSIONS.EXHIBIT_CREATE],
};

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const mode = req.headers['x-test-user'];
    req.user = mode === 'read-only' ? { ...EDITOR, permissions: [PERMISSIONS.EXHIBIT_READ] }
      : mode === 'none' ? { ...EDITOR, permissions: [] }
      : EDITOR;
    return true;
  }
}

class RecordingAuditService {
  entries: Array<{ action: string; resourceType: string; resourceId: string | null; actorId: string | null }> = [];
  async record(entry: { action: string; resourceType: string; resourceId: string | null; actorId: string | null }) {
    this.entries.push(entry);
  }
}

class FakeExhibitsService {
  created = 0;
  detailCalls: string[] = [];
  async searchAdminExhibits() {
    return { items: [], total: 0, page: 1, pageSize: 100 };
  }
  async createExhibitDraft() {
    this.created += 1;
    return { id: `c0000000-0000-4000-8000-${String(this.created).padStart(12, '0')}` };
  }
  async getAdminDetail(id: string) {
    this.detailCalls.push(id);
    return { id };
  }
}

const rooms = {
  async findBySlug(slug: string) {
    return slug === 'phong-gom' ? { id: ROOM_ID, slug, isDeleted: false } : null;
  },
  async findById(id: string) {
    return id === ROOM_ID ? { id, slug: 'phong-gom', isDeleted: false } : null;
  },
};

describe('Xuất/nhập hiện vật qua HTTP (Task 38)', () => {
  let app: INestApplication;
  let exhibits: FakeExhibitsService;
  let audit: RecordingAuditService;

  before(async () => {
    exhibits = new FakeExhibitsService();
    audit = new RecordingAuditService();
    // Cùng thứ tự controller với ExhibitsModule (xem test thứ tự bên dưới).
    const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ExhibitsModule) as unknown[])
      .filter((c) => c === AdminExhibitTransferController || c === AdminExhibitsController) as Array<new (...args: never[]) => unknown>;
    const moduleRef = await Test.createTestingModule({
      controllers,
      providers: [
        ExhibitTransferService,
        { provide: ExhibitsService, useValue: exhibits },
        { provide: RoomsRepository, useValue: rooms },
        { provide: AuditService, useValue: audit },
        { provide: APP_GUARD, useClass: TestAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
  });

  after(async () => {
    await app?.close();
  });

  beforeEach(() => {
    exhibits.created = 0;
    exhibits.detailCalls = [];
    audit.entries = [];
  });

  const http = () => request(app.getHttpServer());
  const importCsv = (csv: string, query = '') =>
    http().post(`/admin/exhibits/import${query}`).attach('file', Buffer.from(csv, 'utf8'), { filename: 'hien-vat.csv', contentType: 'text/csv' });

  it('ExhibitsModule đăng ký controller xuất/nhập TRƯỚC AdminExhibitsController', () => {
    const order = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ExhibitsModule) as unknown[];
    assert.ok(order.indexOf(AdminExhibitTransferController) >= 0);
    assert.ok(order.indexOf(AdminExhibitTransferController) < order.indexOf(AdminExhibitsController));
  });

  describe('GET /admin/exhibits/export', () => {
    it('không bị route :id bắt mất; CSV có BOM, content-type và tên file tải về', async () => {
      const res = await http().get('/admin/exhibits/export').buffer(true).parse((r, cb) => {
        let body = '';
        r.setEncoding('utf8');
        r.on('data', (chunk: string) => (body += chunk));
        r.on('end', () => cb(null, body));
      });
      assert.equal(res.status, 200, String(res.body));
      assert.deepEqual(exhibits.detailCalls, [], 'không được gọi getAdminDetail("export")');
      assert.equal(res.headers['content-type'], 'text/csv; charset=utf-8');
      assert.match(res.headers['content-disposition'], /^attachment; filename="exhibits-\d{8}-\d{4}\.csv"$/);
      assert.ok((res.body as string).startsWith('﻿id,status,') || (res.body as string).startsWith('﻿"id","status"'));
    });

    it('format=json → application/json, tên file .json', async () => {
      const res = await http().get('/admin/exhibits/export?format=json');
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.match(res.headers['content-disposition'], /\.json"$/);
    });

    it('format lạ / roomId sai → 400', async () => {
      assert.equal((await http().get('/admin/exhibits/export?format=xml')).status, 400);
      assert.equal((await http().get('/admin/exhibits/export?roomId=abc')).status, 400);
    });

    it('thiếu quyền exhibit:read → 403', async () => {
      assert.equal((await http().get('/admin/exhibits/export').set('x-test-user', 'none')).status, 403);
    });
  });

  describe('POST /admin/exhibits/import', () => {
    const csv = 'roomSlug,name_vi\nphong-gom,A\nphong-khong-co,B\nphong-gom,C';

    it('dryRun=true → 200 kết quả từng dòng, không tạo, không ghi audit', async () => {
      const res = await importCsv(csv, '?dryRun=true');
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.rows.map((r: { status: string }) => r.status), ['valid', 'error', 'valid']);
      assert.equal(exhibits.created, 0);
      assert.deepEqual(audit.entries, []);
    });

    it('nhập thật → 200 thành công một phần, mỗi hiện vật tạo ra có một bản ghi audit exhibit.import', async () => {
      const res = await importCsv(csv);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.created, 2);
      assert.equal(res.body.data.failed, 1);
      assert.deepEqual(audit.entries.map((e) => [e.action, e.resourceType, e.resourceId, e.actorId]), res.body.data.ids.map((id: string) => ['exhibit.import', 'exhibit', id, EDITOR.id]));
    });

    it('dryRun không phải true/false → 400', async () => {
      assert.equal((await importCsv(csv, '?dryRun=yes')).status, 400);
    });

    it('lỗi cấp file → 422 envelope chuẩn', async () => {
      const res = await importCsv('ten\nA');
      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errors[0].field, 'file');
      assert.equal(res.body.errors[0].code, 'exhibit_import_invalid_file');
    });

    it('thiếu file → 400', async () => {
      const res = await http().post('/admin/exhibits/import').field('x', '1');
      assert.equal(res.status, 400, JSON.stringify(res.body));
    });

    it('file > 2 MB (giới hạn multer) → 413 tiếng Việt, có errors[]', async () => {
      const res = await http().post('/admin/exhibits/import').attach('file', Buffer.alloc(2_500_000, 0x61), 'lon.csv');
      assert.equal(res.status, 413);
      assert.equal(res.body.message, 'File nhập vượt giới hạn 2 MB');
      assert.equal(res.body.errors[0].code, 'exhibit_import_too_large');
    });

    it('sai field / 2 file → 400 tiếng Việt, có errors[]', async () => {
      const wrongField = await http().post('/admin/exhibits/import').attach('upload', Buffer.from(csv), 'a.csv');
      assert.equal(wrongField.status, 400);
      assert.equal(wrongField.body.errors[0].code, 'exhibit_import_invalid_multipart');
      assert.match(wrongField.body.message, /đúng trường/);
      const twoFiles = await http().post('/admin/exhibits/import').attach('file', Buffer.from(csv), 'a.csv').attach('file', Buffer.from(csv), 'b.csv');
      assert.equal(twoFiles.status, 400);
      assert.match(twoFiles.body.message, /một file/);
    });

    it('chỉ có quyền đọc → 403, không tạo gì', async () => {
      const res = await importCsv(csv).set('x-test-user', 'read-only');
      assert.equal(res.status, 403);
      assert.equal(exhibits.created, 0);
    });
  });
});
