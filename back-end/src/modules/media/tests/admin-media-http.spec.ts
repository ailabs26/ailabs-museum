import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { AuthUser } from '../../../common/types/auth-user.type';
import { AUDIT_KEY } from '../../audit/decorators/audit.decorator';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor';
import { AuditService } from '../../audit/services/audit.service';
import { AdminMediaController, MEDIA_UPLOAD_LIMITS } from '../controllers/admin-media.controller';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaStorageService } from '../services/media-storage.service';
import { LocalStorageDriver } from '../storage/local-storage.driver';
import { MEDIA_STORAGE_DRIVER } from '../storage/media-storage-driver';
import { MediaService } from '../services/media.service';
import {
  EXE_FILE,
  SVG_FILE,
  buildGlb,
  buildGlbOfSize,
  buildJpeg,
  buildMp3,
  buildPng,
  buildPngOfSize,
  buildVtt,
  buildWebp,
} from './media-test-files';
import { FakeMediaRepository, FakeTransactionManager, TEST_MEDIA_URL_OPTIONS } from './media-test-doubles';
import { MEDIA_URL_OPTIONS, MediaUrlService } from '../services/media-url.service';

const USER: AuthUser = {
  id: 'b0000000-0000-4000-8000-000000000002',
  email: 'editor@example.test',
  displayName: 'Editor',
  roles: ['editor'],
  permissions: [PERMISSIONS.MEDIA_UPLOAD, PERMISSIONS.MEDIA_ATTACH],
};

/** Thay JwtAuthGuard: gắn user từ header test (`x-test-user: none` = chưa đăng nhập). */
@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const mode = req.headers['x-test-user'];
    if (mode === 'none') return true;
    req.user = mode === 'no-permission' ? { ...USER, permissions: [PERMISSIONS.ROOM_READ] } : USER;
    return true;
  }
}

class RecordingAuditService {
  entries: Array<{ action: string; resourceType: string; resourceId: string; actorId: string | null }> = [];
  async record(entry: { action: string; resourceType: string; resourceId: string; actorId: string | null }) {
    this.entries.push(entry);
  }
}

describe('Admin Media HTTP (multipart thật → pipeline thật)', () => {
  let app: INestApplication;
  let workDir: string;
  let repo: FakeMediaRepository;
  let audit: RecordingAuditService;

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'media-http-'));
    repo = new FakeMediaRepository();
    audit = new RecordingAuditService();
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminMediaController],
      providers: [
        MediaService,
        MediaInspectionService,
        MediaStorageService,
        MediaUrlService,
        { provide: MEDIA_URL_OPTIONS, useValue: TEST_MEDIA_URL_OPTIONS },
        {
          provide: MEDIA_STORAGE_DRIVER,
          useValue: new LocalStorageDriver({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'quarantine') }),
        },
        { provide: MediaRepository, useValue: repo },
        { provide: TransactionManager, useValue: new FakeTransactionManager() },
        { provide: AuditService, useValue: audit },
        { provide: APP_GUARD, useClass: TestAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
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
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo.rows.clear();
    repo.usage = { publishedExhibits: 0, pendingRevisions: 0 };
    audit.entries = [];
  });

  const http = () => request(app.getHttpServer());
  const upload = (buffer: Buffer, filename: string, contentType = 'application/octet-stream') =>
    http().post('/admin/media/upload').attach('file', buffer, { filename, contentType });

  async function seed(buffer = buildPng()): Promise<string> {
    const res = await upload(buffer, 'seed.png', 'image/png').expect(201);
    audit.entries = [];
    return res.body.data.id;
  }

  // --------------------------------------------------------------- nghiệm thu Task 8
  describe('Điều kiện nghiệm thu (plan Task 8)', () => {
    it('upload .glb hợp lệ ≤ 10 MB → 201 và trả về mediaId', async () => {
      const res = await upload(buildGlb(), 'tuong-phat.glb', 'model/gltf-binary').expect(201);
      assert.equal(res.body.success, true);
      assert.match(res.body.data.id, /^[0-9a-f-]{36}$/);
      assert.equal(res.body.data.kind, 'model');
    });

    it('upload .png hợp lệ ≤ 2 MB → 201', async () => {
      const res = await upload(buildPng(), 'anh.png', 'image/png').expect(201);
      assert.equal(res.body.data.mimeType, 'image/png');
    });

    it('upload .mp3 hợp lệ ≤ 10 MB → 201', async () => {
      const res = await upload(buildMp3({ withId3: true }), 'thuyet-minh.mp3', 'audio/mpeg').expect(201);
      assert.equal(res.body.data.kind, 'audio');
    });

    it('upload file .exe đổi tên thành .glb → 422', async () => {
      const res = await upload(EXE_FILE, 'model.glb', 'model/gltf-binary').expect(422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errors[0].code, 'media_unsupported_type');
      assert.equal(res.body.errors[0].field, 'file');
      assert.equal(repo.rows.size, 0);
    });

    it('upload file SVG khai báo image/png → 422', async () => {
      const res = await upload(SVG_FILE, 'logo.png', 'image/png').expect(422);
      assert.equal(res.body.errors[0].code, 'media_markup_rejected');
    });

    it('upload .glb > 10 MB → 413', async () => {
      const res = await upload(buildGlbOfSize(10_000_004), 'lon.glb', 'model/gltf-binary').expect(413);
      assert.equal(res.body.success, false);
      assert.equal(repo.rows.size, 0);
    });

    it('upload .png > 2 MB → 413', async () => {
      const res = await upload(buildPngOfSize(2_000_001), 'lon.png', 'image/png').expect(413);
      assert.equal(res.body.errors[0].code, 'media_too_large');
    });

    it('upload .glb corrupt (magic bytes đúng, nội dung lỗi) → 422', async () => {
      const res = await upload(buildGlb({ json: '{"asset": {"version":', bin: null }), 'hong.glb').expect(422);
      assert.equal(res.body.errors[0].code, 'media_corrupted');
    });

    it('DELETE khi media đang dùng bởi Published exhibit → 409', async () => {
      const id = await seed();
      repo.usage = { publishedExhibits: 1, pendingRevisions: 0 };
      const res = await http().delete(`/admin/media/${id}`).expect(409);
      assert.match(res.body.message, /BR-21/);
    });

    it('DELETE khi media không được dùng → 200', async () => {
      const id = await seed();
      const res = await http().delete(`/admin/media/${id}`).expect(200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data, null);
    });
  });

  // --------------------------------------------------------------- upload chi tiết
  describe('POST /admin/media/upload', () => {
    const formats: Array<[string, () => Buffer, string]> = [
      ['JPEG', () => buildJpeg(), 'image/jpeg'],
      ['WebP', () => buildWebp('lossy'), 'image/webp'],
      ['WebVTT', () => buildVtt(), 'text/vtt'],
    ];
    for (const [label, build, mime] of formats) {
      it(`${label} hợp lệ → 201, mime ${mime}`, async () => {
        const res = await upload(build(), `file.${label.toLowerCase()}`).expect(201);
        assert.equal(res.body.data.mimeType, mime);
      });
    }

    it('lưu metadata gửi kèm trong form, tên file tiếng Việt giữ nguyên', async () => {
      const res = await http()
        .post('/admin/media/upload')
        .field('source', 'Bảo tàng Lịch sử Quân sự')
        .field('author', 'Nguyễn Văn A')
        .field('license', 'CC BY-NC 4.0')
        .field('altText', 'Trống đồng Ngọc Lũ')
        .attach('file', buildPng(), { filename: 'Trống đồng.png', contentType: 'image/png' })
        .expect(201);
      assert.equal(res.body.data.source, 'Bảo tàng Lịch sử Quân sự');
      assert.equal(res.body.data.author, 'Nguyễn Văn A');
      assert.equal(res.body.data.license, 'CC BY-NC 4.0');
      assert.equal(res.body.data.altText, 'Trống đồng Ngọc Lũ');
      assert.equal(res.body.data.originalName, 'Trống đồng.png');
    });

    it('ghi người upload từ token (createdById)', async () => {
      const res = await upload(buildPng(), 'a.png').expect(201);
      assert.equal(res.body.data.createdById, USER.id);
    });

    it('ghi audit "media.upload" với id media vừa tạo', async () => {
      const res = await upload(buildPng(), 'a.png').expect(201);
      assert.deepEqual(
        audit.entries.map(({ action, resourceType, resourceId, actorId }) => ({ action, resourceType, resourceId, actorId })),
        [{ action: 'media.upload', resourceType: 'media', resourceId: res.body.data.id, actorId: USER.id }],
      );
    });

    it('upload bị từ chối → không ghi audit', async () => {
      await upload(SVG_FILE, 'x.svg').expect(422);
      assert.deepEqual(audit.entries, []);
    });

    it('kind=model nhưng file là PNG → 422 media_kind_mismatch', async () => {
      const res = await http().post('/admin/media/upload').field('kind', 'model').attach('file', buildPng(), 'a.png').expect(422);
      assert.equal(res.body.errors[0].code, 'media_kind_mismatch');
    });

    it('kind không hợp lệ → 400', async () => {
      await http().post('/admin/media/upload').field('kind', 'video').attach('file', buildPng(), 'a.png').expect(400);
    });

    it('gửi kèm "url" tùy ý để bypass pipeline → 400, không lưu gì', async () => {
      const res = await http()
        .post('/admin/media/upload')
        .field('url', 'https://evil.example/malware.glb')
        .attach('file', buildPng(), 'a.png')
        .expect(400);
      assert.ok(res.body.errors.some((error: { message: string }) => /url should not exist/.test(error.message)));
      assert.equal(repo.rows.size, 0);
    });

    it('chỉ gửi "url" không kèm file → 400', async () => {
      await http().post('/admin/media/upload').field('url', '/media/x.glb').expect(400);
      assert.equal(repo.rows.size, 0);
    });

    it('thiếu file → 400 media_file_required', async () => {
      const res = await http().post('/admin/media/upload').field('source', 'x').expect(400);
      assert.equal(res.body.errors[0].code, 'media_file_required');
    });

    it('gửi JSON thay vì multipart → 400', async () => {
      await http().post('/admin/media/upload').send({ source: 'x' }).expect(400);
    });

    it('sai tên field ("upload" thay vì "file") → 400', async () => {
      await http().post('/admin/media/upload').attach('upload', buildPng(), 'a.png').expect(400);
      assert.equal(repo.rows.size, 0);
    });

    it('gửi 2 file → 4xx, không lưu gì', async () => {
      const res = await http()
        .post('/admin/media/upload')
        .attach('file', buildPng(), 'a.png')
        .attach('file', buildPng(), 'b.png');
      assert.ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
      assert.equal(repo.rows.size, 0);
    });

    it('file rỗng → 422 media_empty_file', async () => {
      const res = await upload(Buffer.alloc(0), 'empty.png').expect(422);
      assert.equal(res.body.errors[0].code, 'media_empty_file');
    });

    it('PNG đúng 2.000.000 byte qua HTTP → 201', async () => {
      const res = await upload(buildPngOfSize(2_000_000), 'bien.png').expect(201);
      assert.equal(res.body.data.sizeBytes, 2_000_000);
    });

    it('GLB đúng 10.000.000 byte qua HTTP (sát trần multer) → 201', async () => {
      const res = await upload(buildGlbOfSize(10_000_000), 'bien.glb').expect(201);
      assert.equal(res.body.data.sizeBytes, 10_000_000);
    });

    it('file 10.000.001 byte qua HTTP → 413 (vượt 10 MB đúng 1 byte)', async () => {
      const oneByteOver = Buffer.concat([buildGlbOfSize(10_000_000), Buffer.alloc(1)]);
      assert.equal(oneByteOver.length, 10_000_001);
      await upload(oneByteOver, 'qua-1-byte.glb').expect(413);
      assert.equal(repo.rows.size, 0);
    });

    it('trần multer = 10 MB + 1 byte (busboy chặn cả file dài đúng bằng giới hạn), tối đa 1 file', () => {
      assert.equal(MEDIA_UPLOAD_LIMITS.fileSize, 10_000_001);
      assert.equal(MEDIA_UPLOAD_LIMITS.files, 1);
    });

    it('metadata vượt độ dài → 400 và không lưu file', async () => {
      await http().post('/admin/media/upload').field('author', 'a'.repeat(201)).attach('file', buildPng(), 'a.png').expect(400);
      assert.equal(repo.rows.size, 0);
    });
  });

  // --------------------------------------------------------------- đọc / sửa / xóa
  describe('GET / PATCH / DELETE', () => {
    it('GET /admin/media → danh sách có meta phân trang', async () => {
      await seed();
      await seed();
      const res = await http().get('/admin/media?page=1&pageSize=10').expect(200);
      assert.equal(res.body.data.length, 2);
      assert.deepEqual(res.body.meta, { page: 1, pageSize: 10, total: 2 });
    });

    it('GET /admin/media?kind=video → 400', async () => {
      await http().get('/admin/media?kind=video').expect(400);
    });

    it('GET /admin/media/:id → 200', async () => {
      const id = await seed();
      const res = await http().get(`/admin/media/${id}`).expect(200);
      assert.equal(res.body.data.id, id);
      assert.equal('storageKey' in res.body.data, false);
    });

    it('GET /admin/media/:id không phải UUID → 400', async () => {
      await http().get('/admin/media/abc').expect(400);
    });

    it('GET /admin/media/:id không tồn tại → 404', async () => {
      await http().get(`/admin/media/${randomUUID()}`).expect(404);
    });

    it('PATCH cập nhật metadata → 200 và ghi audit "media.update"', async () => {
      const id = await seed();
      const res = await http().patch(`/admin/media/${id}`).send({ license: 'CC0', author: 'B' }).expect(200);
      assert.equal(res.body.data.license, 'CC0');
      assert.equal(res.body.data.author, 'B');
      assert.equal(audit.entries[0]?.action, 'media.update');
      assert.equal(audit.entries[0]?.resourceId, id);
    });

    it('PATCH với "url" → 400 (không thay file qua metadata)', async () => {
      const id = await seed();
      await http().patch(`/admin/media/${id}`).send({ url: '/media/other.png' }).expect(400);
    });

    it('PATCH không tồn tại → 404', async () => {
      await http().patch(`/admin/media/${randomUUID()}`).send({ license: 'x' }).expect(404);
    });

    it('DELETE thành công → ghi audit "media.delete", sau đó GET → 404', async () => {
      const id = await seed();
      await http().delete(`/admin/media/${id}`).expect(200);
      assert.equal(audit.entries[0]?.action, 'media.delete');
      assert.equal(audit.entries[0]?.resourceId, id);
      await http().get(`/admin/media/${id}`).expect(404);
    });

    it('DELETE khi đang trong nội dung chờ duyệt → 409', async () => {
      const id = await seed();
      repo.usage = { publishedExhibits: 0, pendingRevisions: 2 };
      await http().delete(`/admin/media/${id}`).expect(409);
      assert.deepEqual(audit.entries, [], 'thất bại thì không ghi audit');
    });

    it('DELETE không tồn tại → 404', async () => {
      await http().delete(`/admin/media/${randomUUID()}`).expect(404);
    });
  });

  // --------------------------------------------------------------- RBAC
  describe('RBAC — yêu cầu quyền media:upload', () => {
    const routes: Array<[string, string, (id: string) => request.Test]> = [
      ['GET', '/admin/media', () => http().get('/admin/media')],
      ['GET', '/admin/media/:id', (id) => http().get(`/admin/media/${id}`)],
      ['POST', '/admin/media/upload', () => http().post('/admin/media/upload').attach('file', buildPng(), 'a.png')],
      ['PATCH', '/admin/media/:id', (id) => http().patch(`/admin/media/${id}`).send({ license: 'x' })],
      ['DELETE', '/admin/media/:id', (id) => http().delete(`/admin/media/${id}`)],
    ];

    for (const [method, path, call] of routes) {
      it(`${method} ${path}: thiếu quyền → 403, không thay đổi dữ liệu`, async () => {
        const id = await seed();
        const before = repo.rows.size;
        const res = await call(id).set('x-test-user', 'no-permission').expect(403);
        assert.match(res.body.message, /media:upload/);
        assert.equal(repo.rows.size, before);
        assert.equal(repo.rows.get(id)?.isDeleted, false);
      });

      it(`${method} ${path}: chưa xác thực → 403`, async () => {
        const id = await seed();
        await call(id).set('x-test-user', 'none').expect(403);
      });
    }

    it('metadata decorator: mọi route khai báo đúng quyền và audit', () => {
      const reflector = new Reflector();
      const proto = AdminMediaController.prototype;
      for (const handler of [proto.list, proto.getById, proto.upload, proto.update, proto.remove]) {
        assert.deepEqual(reflector.get(PERMISSIONS_KEY, handler), [PERMISSIONS.MEDIA_UPLOAD]);
      }
      assert.deepEqual(reflector.get(AUDIT_KEY, proto.upload), { action: 'media.upload', resourceType: 'media' });
      assert.deepEqual(reflector.get(AUDIT_KEY, proto.update), { action: 'media.update', resourceType: 'media' });
      assert.deepEqual(reflector.get(AUDIT_KEY, proto.remove), { action: 'media.delete', resourceType: 'media' });
      assert.equal(reflector.get(AUDIT_KEY, proto.list), undefined);
    });
  });
});
