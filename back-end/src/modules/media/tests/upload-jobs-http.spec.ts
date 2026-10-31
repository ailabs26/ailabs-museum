import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { CanActivate, ExecutionContext, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { AuthUser } from '../../../common/types/auth-user.type';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor';
import { AuditService } from '../../audit/services/audit.service';
import { AdminMediaController } from '../controllers/admin-media.controller';
import { AdminUploadJobsController } from '../controllers/admin-upload-jobs.controller';
import { MediaProcessingState } from '../entities/media.entity';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaStorageService } from '../services/media-storage.service';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MEDIA_URL_OPTIONS, MediaUrlService } from '../services/media-url.service';
import { MediaService } from '../services/media.service';
import { LocalStorageDriver } from '../storage/local-storage.driver';
import { MEDIA_STORAGE_DRIVER } from '../storage/media-storage-driver';
import {
  FakeMediaRepository,
  FakeTransactionManager,
  FakeUploadJobRepository,
  TEST_MEDIA_URL_OPTIONS,
} from './media-test-doubles';
import { EXE_FILE, buildGlb, buildGlbOfSize, buildPngOfSize } from './media-test-files';

/**
 * VT-078 — upload media bất đồng bộ qua HTTP thật (multipart → controller → job service →
 * pipeline MediaService thật → storage đĩa tạm). Repository là fake trong bộ nhớ.
 */

const EDITOR: AuthUser = {
  id: 'b0000000-0000-4000-8000-000000000002',
  email: 'editor@example.test',
  displayName: 'Editor',
  roles: ['editor'],
  permissions: [PERMISSIONS.MEDIA_UPLOAD],
};
const OTHER_EDITOR: AuthUser = { ...EDITOR, id: 'b0000000-0000-4000-8000-000000000003', email: 'other@example.test' };

/** Thay JwtAuthGuard: `x-test-user: other` = biên tập viên khác. */
@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = req.headers['x-test-user'] === 'other' ? OTHER_EDITOR : EDITOR;
    return true;
  }
}

class RecordingAuditService {
  entries: Array<{ action: string; resourceType: string; resourceId: string | null }> = [];
  async record(entry: { action: string; resourceType: string; resourceId: string | null }) {
    this.entries.push(entry);
  }
}

const TERMINAL = ['succeeded', 'failed'];

describe('Upload media bất đồng bộ (VT-078) — HTTP', () => {
  let app: INestApplication;
  let workDir: string;
  let mediaRepo: FakeMediaRepository;
  let jobRepo: FakeUploadJobRepository;
  let audit: RecordingAuditService;
  let jobService: MediaUploadJobService;

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'upload-jobs-http-'));
    mediaRepo = new FakeMediaRepository();
    jobRepo = new FakeUploadJobRepository();
    audit = new RecordingAuditService();
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUploadJobsController, AdminMediaController],
      providers: [
        MediaUploadJobService,
        MediaService,
        MediaInspectionService,
        MediaStorageService,
        MediaUrlService,
        { provide: MEDIA_URL_OPTIONS, useValue: TEST_MEDIA_URL_OPTIONS },
        {
          provide: MEDIA_STORAGE_DRIVER,
          useValue: new LocalStorageDriver({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'quarantine') }),
        },
        { provide: MediaRepository, useValue: mediaRepo },
        { provide: MediaUploadJobRepository, useValue: jobRepo },
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
    jobService = app.get(MediaUploadJobService);
  });

  after(async () => {
    await app?.close();
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    mediaRepo.rows.clear();
    jobRepo.rows.clear();
    jobRepo.patches = [];
    audit.entries = [];
  });

  // Không để worker của test trước chạy lấn sang test sau (shared state).
  afterEach(async () => {
    await jobService.whenIdle().catch(() => undefined);
  });

  const http = () => request(app.getHttpServer());

  function createJob(buffer: Buffer, key: string | undefined = randomUUID(), options: { filename?: string; user?: string } = {}) {
    let req = http().post('/admin/media/upload-jobs');
    if (key !== undefined) req = req.set('Idempotency-Key', key);
    if (options.user) req = req.set('x-test-user', options.user);
    return req.attach('file', buffer, { filename: options.filename ?? 'tuong-phat.glb', contentType: 'model/gltf-binary' });
  }

  /** Poll trạng thái tới khi kết thúc; timeout thay cho sleep cố định (tránh flaky theo thời gian). */
  async function waitForTerminal(jobId: string, timeoutMs = 5_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const res = await http().get(`/admin/media/upload-jobs/${jobId}`).expect(200);
      if (TERMINAL.includes(res.body.data.status)) return res.body.data;
      if (Date.now() > deadline) assert.fail(`job ${jobId} chưa kết thúc sau ${timeoutMs} ms (status ${res.body.data.status})`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // ------------------------------------------------------------------ AC1, AC2
  describe('AC1–AC2: tạo job và theo dõi tiến trình', () => {
    it('TC01 — GLB hợp lệ + key mới → 202, status queued, progress 0, có id', async () => {
      const res = await createJob(buildGlb()).expect(202);
      assert.equal(res.body.success, true);
      assert.match(res.body.data.id, /^[0-9a-f-]{36}$/);
      assert.equal(res.body.data.status, 'queued');
      assert.equal(res.body.data.progress, 0);
      assert.equal(res.body.data.mediaId, null);
      assert.equal(jobRepo.rows.size, 1);
    });

    it('TC02 — E2E API: tạo job → poll → succeeded, progress 100, mediaId trỏ tới media ready', async () => {
      const created = await createJob(buildGlb()).expect(202);
      const done = await waitForTerminal(created.body.data.id);
      assert.equal(done.status, 'succeeded');
      assert.equal(done.progress, 100);
      assert.equal(done.errorCode, null);
      assert.match(done.mediaId, /^[0-9a-f-]{36}$/);

      const media = await http().get(`/admin/media/${done.mediaId}`).expect(200);
      assert.equal(media.body.data.kind, 'model');
      assert.equal(media.body.data.processingState, MediaProcessingState.READY);
      assert.deepEqual(
        jobRepo.patches.map((p) => [p.data.status, p.data.progress]),
        [['processing', 50], ['succeeded', 100]],
      );
    });

    it('ghi audit với resource type media_upload_job và id của job', async () => {
      const res = await createJob(buildGlb()).expect(202);
      assert.deepEqual(
        audit.entries.map((e) => [e.action, e.resourceType, e.resourceId]),
        [['media.upload_job.create', 'media_upload_job', res.body.data.id]],
      );
    });
  });

  // ------------------------------------------------------------------ AC3 (risk trọng tâm)
  describe('AC3: retry cùng Idempotency-Key không tạo bản ghi trùng', () => {
    it('TC03 — gửi lại tuần tự cùng key + cùng file → 200, cùng job, 1 job, 1 media', async () => {
      const key = randomUUID();
      const first = await createJob(buildGlb(), key).expect(202);
      await waitForTerminal(first.body.data.id);

      const retry = await createJob(buildGlb(), key).expect(200);
      assert.equal(retry.body.data.id, first.body.data.id);
      assert.equal(retry.body.data.status, 'succeeded');
      await jobService.whenIdle();
      assert.equal(jobRepo.rows.size, 1);
      assert.equal(mediaRepo.rows.size, 1);
    });

    it('TC04 — 20 request đồng thời cùng key → đúng 1 lần 202, cùng một job, 1 media', async () => {
      const key = randomUUID();
      const responses = await Promise.all(Array.from({ length: 20 }, () => createJob(buildGlb(), key)));
      assert.equal(responses.filter((r) => r.status === 202).length, 1);
      assert.equal(responses.filter((r) => r.status === 200).length, 19);
      assert.equal(new Set(responses.map((r) => r.body.data.id)).size, 1);
      await jobService.whenIdle();
      assert.equal(jobRepo.rows.size, 1);
      assert.equal(mediaRepo.rows.size, 1);
    });

    it('cùng key nhưng khác người tạo → hai job độc lập (key chỉ duy nhất theo người tạo)', async () => {
      const key = randomUUID();
      const mine = await createJob(buildGlb(), key).expect(202);
      const theirs = await createJob(buildGlb(), key, { user: 'other' }).expect(202);
      assert.notEqual(mine.body.data.id, theirs.body.data.id);
      assert.equal(jobRepo.rows.size, 2);
    });
  });

  // ------------------------------------------------------------------ AC5 + phân lớp Idempotency-Key
  describe('AC5: phân lớp tương đương Idempotency-Key', () => {
    it('TC05 — key đã dùng + nội dung khác → 409 idempotency_key_reused, không thêm job', async () => {
      const key = randomUUID();
      await createJob(buildGlb(), key).expect(202);
      const res = await createJob(buildGlb({ bin: Buffer.alloc(16, 1) }), key).expect(409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errors[0].code, 'idempotency_key_reused');
      assert.equal(jobRepo.rows.size, 1);
    });

    it('TC06 — thiếu header → 400 idempotency_key_required, không tạo job', async () => {
      const res = await createJob(buildGlb(), undefined).expect(400);
      assert.equal(res.body.errors[0].field, 'Idempotency-Key');
      assert.equal(res.body.errors[0].code, 'idempotency_key_required');
      assert.equal(jobRepo.rows.size, 0);
    });

    it('TC06b — header rỗng → 400 idempotency_key_required', async () => {
      const res = await createJob(buildGlb(), '').expect(400);
      assert.equal(res.body.errors[0].code, 'idempotency_key_required');
    });

    for (const [label, key] of [
      ['129 ký tự (ngay trên biên)', 'a'.repeat(129)],
      ['chứa khoảng trắng', 'abc def'],
      ['chứa ký tự "/"', 'a/b'],
    ] as const) {
      it(`TC07 — key ${label} → 400 idempotency_key_invalid`, async () => {
        const res = await createJob(buildGlb(), key).expect(400);
        assert.equal(res.body.errors[0].field, 'Idempotency-Key');
        assert.equal(res.body.errors[0].code, 'idempotency_key_invalid');
        assert.equal(jobRepo.rows.size, 0);
      });
    }

    for (const [label, key] of [
      ['1 ký tự (biên dưới)', 'k'],
      ['128 ký tự (biên trên)', 'b'.repeat(128)],
      ['dạng UUID (đại diện lớp hợp lệ)', randomUUID()],
    ] as const) {
      it(`key ${label} → 202`, async () => {
        await createJob(buildGlb(), key).expect(202);
      });
    }
  });

  // ------------------------------------------------------------------ AC4 + phân lớp file
  describe('AC4: phân lớp tương đương file — lỗi pipeline thành job failed', () => {
    for (const [tc, label, buffer, filename, code] of [
      ['TC08', 'file EXE đổi đuôi .glb', EXE_FILE, 'model.glb', 'media_unsupported_type'],
      ['TC08b', 'PNG vượt 2 MB (giới hạn theo định dạng)', buildPngOfSize(2_000_001), 'lon.png', 'media_too_large'],
      ['TC08c', 'GLB hỏng cấu trúc', buildGlb({ json: '{"asset": {"version":', bin: null }), 'hong.glb', 'media_corrupted'],
    ] as const) {
      it(`${tc} — ${label} → 202 rồi failed (${code}), không có media ready`, async () => {
        const created = await createJob(buffer, randomUUID(), { filename }).expect(202);
        const done = await waitForTerminal(created.body.data.id);
        assert.equal(done.status, 'failed');
        assert.equal(done.errorCode, code);
        assert.equal(typeof done.errorMessage, 'string');
        assert.equal(done.mediaId, null);
        assert.equal([...mediaRepo.rows.values()].filter((m) => m.processingState === MediaProcessingState.READY).length, 0);
      });
    }

    it('thiếu file → 400 ngay, không tạo job', async () => {
      const res = await http().post('/admin/media/upload-jobs').set('Idempotency-Key', randomUUID()).field('altText', 'x').expect(400);
      assert.equal(res.body.errors[0].field, 'file');
      assert.equal(jobRepo.rows.size, 0);
    });

    it('vượt giới hạn multipart (> 10 MB) → 413 ngay, không tạo job', async () => {
      await createJob(buildGlbOfSize(10_000_004)).expect(413);
      assert.equal(jobRepo.rows.size, 0);
    });
  });

  // ------------------------------------------------------------------ phân lớp jobId
  describe('GET /admin/media/upload-jobs/:id — phân lớp jobId', () => {
    it('TC11 — UUID không tồn tại → 404', async () => {
      await http().get(`/admin/media/upload-jobs/${randomUUID()}`).expect(404);
    });

    it('TC11b — job của biên tập viên khác → 404 (không lộ sự tồn tại)', async () => {
      const created = await createJob(buildGlb()).expect(202);
      await http().get(`/admin/media/upload-jobs/${created.body.data.id}`).set('x-test-user', 'other').expect(404);
    });

    it('TC12 — id không phải UUID → 400', async () => {
      await http().get('/admin/media/upload-jobs/khong-phai-uuid').expect(400);
    });
  });
});
