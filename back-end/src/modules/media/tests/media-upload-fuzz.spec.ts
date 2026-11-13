import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { CanActivate, ExecutionContext, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { Media, MediaProcessingState } from '../entities/media.entity';
import { MediaErrorCode } from '../inspection/media-format.error';
import { MEDIA_FORMAT_SPECS } from '../inspection/media-formats';
import { detectMediaFormat } from '../inspection/media-signature';
import { validateMediaStructure } from '../inspection/media-structure';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaStorageService } from '../services/media-storage.service';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MEDIA_URL_OPTIONS, MediaUrlService } from '../services/media-url.service';
import { MediaService } from '../services/media.service';
import { LocalStorageDriver } from '../storage/local-storage.driver';
import { MEDIA_STORAGE_DRIVER } from '../storage/media-storage-driver';
import { FuzzCase, HOSTILE_FILENAMES, HOSTILE_FILES, mutatedCases } from './media-fuzz-corpus';
import {
  FakeMediaRepository,
  FakeTransactionManager,
  FakeUploadJobRepository,
  TEST_MEDIA_URL_OPTIONS,
  testUploadJobConfig,
} from './media-test-doubles';
import { buildGlb, buildGlbOfSize, buildPng, buildPngOfSize } from './media-test-files';

/**
 * Task 28 (AC-33) — fuzz upload media qua HTTP thật: multipart → FileInterceptor → MediaService
 * thật → storage đĩa tạm. Repository là fake trong bộ nhớ để kiểm tra chính xác bản ghi được tạo.
 *
 * Bất biến cho MỌI đầu vào:
 *   I1. Không bao giờ 5xx — chỉ 201/400/413/422 (job: 202 rồi succeeded/failed).
 *   I2. Bị từ chối → envelope lỗi chuẩn, `errors[0]` có `field: 'file'` và mã thuộc `MediaErrorCode`.
 *   I3. Bị từ chối → không có media READY mới; chỉ `media_quarantined` được phép để lại 1 bản ghi
 *       QUARANTINED (file nằm trong thư mục cách ly, không phục vụ công khai).
 *   I4. Được nhận → đúng 1 media READY, MIME lấy từ nội dung (không theo tên/Content-Type khai báo),
 *       file trên đĩa trùng từng byte, nội dung qua được kiểm tra cấu trúc.
 *   I5. File trên đĩa luôn khớp 1–1 với bản ghi (không rác, không mất file).
 *   I6. Upload đồng bộ và job bất đồng bộ cho cùng kết quả với cùng nội dung.
 *
 * Tái lập: `FUZZ_SEED=<seed> FUZZ_ITERATIONS=<n> npm run test:fuzz`.
 */
const SEED = Number(process.env.FUZZ_SEED ?? 20261113);
const PER_FORMAT = Number(process.env.FUZZ_ITERATIONS ?? 40);
const ALLOWED_STATUS = new Set([201, 400, 413, 422]);
const ERROR_CODES = new Set<string>(Object.values(MediaErrorCode));
const TERMINAL = ['succeeded', 'failed'];

const EDITOR: AuthUser = {
  id: 'b0000000-0000-4000-8000-000000000002',
  email: 'editor@example.test',
  displayName: 'Editor',
  roles: ['editor'],
  permissions: [PERMISSIONS.MEDIA_UPLOAD, PERMISSIONS.MEDIA_ATTACH],
};

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = EDITOR;
    return true;
  }
}

class NoopAuditService {
  async record() {}
  recordSafely() {
    return Promise.resolve();
  }
}

const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : Promise.resolve([join(dir, entry.name)]))),
  );
  return nested.flat();
}

describe(`Fuzz upload media (Task 28, AC-33) — seed ${SEED}, ${PER_FORMAT} biến thể/định dạng`, () => {
  let app: INestApplication;
  let workDir: string;
  let publicRoot: string;
  let quarantineRoot: string;
  let mediaRepo: FakeMediaRepository;
  let jobRepo: FakeUploadJobRepository;
  let jobService: MediaUploadJobService;
  /** Thống kê kết quả theo mã để in ra cuối bài (bằng chứng). */
  const outcomes = new Map<string, number>();
  const count = (key: string) => outcomes.set(key, (outcomes.get(key) ?? 0) + 1);

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'media-fuzz-'));
    publicRoot = join(workDir, 'public');
    quarantineRoot = join(workDir, 'quarantine');
    mediaRepo = new FakeMediaRepository();
    jobRepo = new FakeUploadJobRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminMediaController, AdminUploadJobsController],
      providers: [
        MediaService,
        MediaUploadJobService,
        MediaInspectionService,
        MediaStorageService,
        MediaUrlService,
        { provide: MEDIA_URL_OPTIONS, useValue: TEST_MEDIA_URL_OPTIONS },
        { provide: MEDIA_STORAGE_DRIVER, useValue: new LocalStorageDriver({ publicRoot, quarantineRoot }) },
        { provide: MediaRepository, useValue: mediaRepo },
        { provide: MediaUploadJobRepository, useValue: jobRepo },
        { provide: TransactionManager, useValue: new FakeTransactionManager() },
        { provide: AuditService, useValue: new NoopAuditService() },
        { provide: ConfigService, useValue: testUploadJobConfig() },
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
    jobService = app.get(MediaUploadJobService);
  });

  after(async () => {
    const summary = [...outcomes.entries()].sort().map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`[fuzz] seed=${SEED} perFormat=${PER_FORMAT} kết quả: ${summary}`);
    await app?.close();
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    mediaRepo.rows.clear();
    jobRepo.rows.clear();
    await rm(publicRoot, { recursive: true, force: true });
    await rm(quarantineRoot, { recursive: true, force: true });
  });

  afterEach(async () => {
    await jobService.whenIdle().catch(() => undefined);
  });

  const http = () => request(app.getHttpServer());
  const upload = (c: Pick<FuzzCase, 'buffer' | 'filename' | 'contentType'>) =>
    http().post('/admin/media/upload').attach('file', c.buffer, { filename: c.filename, contentType: c.contentType });

  function pathOf(row: Media): string {
    return row.storageKey.startsWith('quarantine/')
      ? join(quarantineRoot, row.storageKey.slice('quarantine/'.length))
      : join(publicRoot, row.storageKey);
  }

  /** I5: tập file trên đĩa == tập file mà bản ghi trỏ tới. */
  async function assertDiskMatchesRows() {
    const onDisk = [...(await listFiles(publicRoot)), ...(await listFiles(quarantineRoot))].map((p) => resolve(p)).sort();
    const expected = [...mediaRepo.rows.values()].map((row) => resolve(pathOf(row))).sort();
    assert.deepEqual(onDisk, expected, 'file trên đĩa phải khớp 1–1 với bản ghi media');
  }

  /** I1–I5 cho một response upload đồng bộ. Trả về nhãn kết quả để so với job (I6). */
  async function assertUploadInvariants(res: request.Response, buffer: Buffer, label: string): Promise<string> {
    assert.ok(ALLOWED_STATUS.has(res.status), `[${label}] status ngoài dự kiến ${res.status}: ${JSON.stringify(res.body)}`);
    const rows = [...mediaRepo.rows.values()];

    if (res.status === 201) {
      assert.equal(res.body.success, true);
      assert.equal(rows.length, 1, `[${label}] phải tạo đúng 1 media`);
      const [row] = rows;
      const format = detectMediaFormat(buffer);
      assert.ok(format, `[${label}] được nhận nhưng magic bytes không nhận diện được`);
      assert.equal(row.processingState, MediaProcessingState.READY);
      assert.equal(row.mimeType, MEDIA_FORMAT_SPECS[format].mimeType, `[${label}] MIME phải lấy từ nội dung`);
      assert.equal(res.body.data.mimeType, row.mimeType);
      assert.ok(buffer.length <= MEDIA_FORMAT_SPECS[format].maxBytes);
      assert.doesNotThrow(() => validateMediaStructure(format, buffer), `[${label}] file nhận vào phải qua kiểm tra cấu trúc`);
      assert.equal(sha256(await readFile(pathOf(row))), sha256(buffer), `[${label}] file lưu phải trùng từng byte`);
      assert.ok(!relative(join(publicRoot, 'uploads'), pathOf(row)).startsWith('..'), 'file phải nằm trong uploads/');
      await assertDiskMatchesRows();
      count('accepted');
      return 'accepted';
    }

    assert.equal(res.body.success, false, `[${label}] lỗi phải có success=false`);
    const [error] = res.body.errors ?? [];
    assert.ok(error, `[${label}] thiếu errors[]: ${JSON.stringify(res.body)}`);
    assert.equal(error.field, 'file');
    assert.ok(ERROR_CODES.has(error.code), `[${label}] mã lỗi lạ: ${error.code}`);
    if (error.code === MediaErrorCode.QUARANTINED) {
      assert.equal(res.status, 422);
      assert.equal(rows.length, 1, `[${label}] cách ly phải để lại đúng 1 bản ghi`);
      assert.equal(rows[0].processingState, MediaProcessingState.QUARANTINED);
      assert.ok(rows[0].storageKey.startsWith('quarantine/'), 'file cách ly không được nằm trong thư mục công khai');
    } else {
      assert.equal(rows.length, 0, `[${label}] bị từ chối (${error.code}) nhưng vẫn tạo media`);
    }
    await assertDiskMatchesRows();
    count(`${res.status}:${error.code}`);
    return error.code;
  }

  async function waitForTerminal(jobId: string, timeoutMs = 5_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const res = await http().get(`/admin/media/upload-jobs/${jobId}`).expect(200);
      if (TERMINAL.includes(res.body.data.status)) return res.body.data;
      if (Date.now() > deadline) assert.fail(`job ${jobId} chưa kết thúc sau ${timeoutMs} ms`);
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  /** Upload cùng nội dung qua job bất đồng bộ; trả về nhãn kết quả cùng hệ với upload đồng bộ. */
  async function jobOutcome(c: FuzzCase, accepted: string[] = []): Promise<string> {
    const readyBefore = new Set(readyIds());
    const created = await http()
      .post('/admin/media/upload-jobs')
      .set('Idempotency-Key', randomUUID())
      .attach('file', c.buffer, { filename: c.filename, contentType: c.contentType });
    if (created.status !== 202) {
      assert.ok(ALLOWED_STATUS.has(created.status), `[${c.label}] tạo job: status ${created.status}`);
      return created.body.errors?.[0]?.code ?? `http-${created.status}`;
    }
    const done = await waitForTerminal(created.body.data.id);
    if (done.status === 'succeeded') {
      const media = mediaRepo.rows.get(done.mediaId);
      assert.equal(media?.processingState, MediaProcessingState.READY, `[${c.label}] job succeeded phải trỏ media READY`);
      accepted.push(done.mediaId);
      return 'accepted';
    }
    assert.equal(done.mediaId, null, `[${c.label}] job failed không được có mediaId`);
    assert.deepEqual(readyIds().filter((id) => !readyBefore.has(id)), [], `[${c.label}] job failed nhưng tạo media READY mới`);
    await assertDiskMatchesRows();
    return done.errorCode;
  }

  function readyIds(): string[] {
    return [...mediaRepo.rows.values()].filter((row) => row.processingState === MediaProcessingState.READY).map((row) => row.id);
  }

  // ------------------------------------------------------------ 1. đột biến ngẫu nhiên có seed
  describe('Đột biến từ file hợp lệ (bit flip, cắt cụt, chèn, trường độ dài biên, payload)', () => {
    for (const c of mutatedCases(SEED, PER_FORMAT)) {
      it(`${c.label} — đồng bộ và job cho cùng kết quả an toàn`, async () => {
        const syncOutcome = await assertUploadInvariants(await upload(c), c.buffer, c.label);
        mediaRepo.rows.clear();
        await rm(publicRoot, { recursive: true, force: true });
        await rm(quarantineRoot, { recursive: true, force: true });
        assert.equal(await jobOutcome(c), syncOutcome, `[${c.label}] I6: job phải cho cùng kết quả với upload đồng bộ`);
      });
    }
  });

  // ------------------------------------------------------------ 2. file độc / đánh lừa
  describe('File độc, sai đuôi/MIME, polyglot', () => {
    for (const c of HOSTILE_FILES) {
      it(`${c.label} → bị từ chối, không tạo media`, async () => {
        const res = await upload(c);
        assert.notEqual(res.status, 201, `[${c.label}] file độc không được nhận`);
        await assertUploadInvariants(res, c.buffer, c.label);
      });
    }

    it('polyglot: PNG hợp lệ + HTML/script sau IEND → được nhận (Task 8 chủ đích bỏ qua đuôi) nhưng KHÔNG thực thi được', async () => {
      // Dữ liệu sau IEND bị decoder bỏ qua (media-structure.spec: "dữ liệu thừa sau IEND được bỏ qua").
      // An toàn nằm ở tầng phục vụ: Content-Type theo nội dung + nosniff + CSP sandbox, nên trình duyệt
      // không bao giờ diễn giải phần đuôi như HTML.
      const polyglot = Buffer.concat([buildPng(), Buffer.from('<html><script>alert(1)</script></html>')]);
      const res = await upload({ buffer: polyglot, filename: 'a.html', contentType: 'text/html' });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.mimeType, 'image/png');
      await assertUploadInvariants(res, polyglot, 'png+html');
      const served = await http().get(`/admin/media/${res.body.data.id}/content`);
      assert.equal(served.headers['content-type'], 'image/png');
      assert.equal(served.headers['x-content-type-options'], 'nosniff');
      assert.equal(served.headers['content-security-policy'], "default-src 'none'; sandbox");
    });

    it('polyglot: GLB có script nối đuôi → bị từ chối (độ dài header không khớp)', async () => {
      const polyglot = Buffer.concat([buildGlb(), Buffer.from('<script>alert(1)</script>')]);
      const res = await upload({ buffer: polyglot, filename: 'a.glb', contentType: 'model/gltf-binary' });
      assert.notEqual(res.status, 201);
      await assertUploadInvariants(res, polyglot, 'glb+script');
    });

    it('VTT có thẻ <script> trong cue → được nhận như văn bản (FE hiển thị bằng textContent, không thực thi)', async () => {
      const vtt = Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\n<script>alert(1)</script><b>đậm</b>\n');
      const res = await upload({ buffer: vtt, filename: 'a.vtt', contentType: 'text/vtt' });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.mimeType, 'text/vtt');
      await assertUploadInvariants(res, vtt, 'vtt-script');
    });

    it('nội dung hợp lệ nhưng khai báo sai đuôi/MIME → MIME theo nội dung thật', async () => {
      const png = buildPng();
      for (const [filename, contentType] of [['x.glb', 'model/gltf-binary'], ['x.mp3', 'audio/mpeg'], ['x', 'application/octet-stream'], ['x.svg', 'image/svg+xml']]) {
        mediaRepo.rows.clear();
        await rm(publicRoot, { recursive: true, force: true });
        const res = await upload({ buffer: png, filename, contentType });
        assert.equal(res.status, 201, `${filename}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.data.mimeType, 'image/png');
        await assertUploadInvariants(res, png, `png-as-${filename}`);
      }
    });

    it('kind khai báo không khớp nội dung → 422 media_kind_mismatch, không tạo media', async () => {
      const res = await http().post('/admin/media/upload').field('kind', 'model')
        .attach('file', buildPng(), { filename: 'a.png', contentType: 'image/png' });
      assert.equal(res.status, 422);
      assert.equal(res.body.errors[0].code, MediaErrorCode.KIND_MISMATCH);
      await assertUploadInvariants(res, buildPng(), 'kind-mismatch');
    });
  });

  // ------------------------------------------------------------ 3. dung lượng biên
  describe('Dung lượng biên', () => {
    it('file rỗng → 422 media_empty_file', async () => {
      const res = await upload({ buffer: Buffer.alloc(0), filename: 'a.png', contentType: 'image/png' });
      assert.equal(res.status, 422);
      assert.equal(res.body.errors[0].code, MediaErrorCode.EMPTY_FILE);
      await assertUploadInvariants(res, Buffer.alloc(0), 'empty');
    });

    for (const [label, buffer, expected] of [
      ['PNG đúng 2.000.000 byte', buildPngOfSize(2_000_000), 201],
      ['PNG 2.000.001 byte', buildPngOfSize(2_000_001), 413],
      ['GLB đúng 10.000.000 byte', buildGlbOfSize(10_000_000), 201],
      ['GLB 10.000.004 byte (vượt cả giới hạn multer)', buildGlbOfSize(10_000_004), 413],
    ] as const) {
      it(`${label} → ${expected}`, async () => {
        const res = await upload({ buffer, filename: 'a.bin', contentType: 'application/octet-stream' });
        assert.equal(res.status, expected, JSON.stringify(res.body));
        await assertUploadInvariants(res, buffer, label);
      });
    }

    it('15 MB byte ngẫu nhiên → 413, không ghi gì ra đĩa', async () => {
      const big = Buffer.alloc(15_000_000, 0x41);
      const res = await upload({ buffer: big, filename: 'a.glb', contentType: 'model/gltf-binary' });
      assert.equal(res.status, 413);
      assert.equal(res.body.errors[0].code, MediaErrorCode.TOO_LARGE);
      assert.equal(res.body.message, 'File vượt giới hạn tải lên tối đa 10 MB', 'thông điệp tiếng Việt, không phải "File too large"');
      await assertUploadInvariants(res, big, '15mb');
    });

    it('job: 15 MB → 413 cùng envelope, không tạo job', async () => {
      const res = await http().post('/admin/media/upload-jobs').set('Idempotency-Key', randomUUID())
        .attach('file', Buffer.alloc(15_000_000, 0x41), { filename: 'a.glb', contentType: 'model/gltf-binary' });
      assert.equal(res.status, 413);
      assert.equal(res.body.errors[0].code, MediaErrorCode.TOO_LARGE);
      assert.equal(jobRepo.rows.size, 0);
      await assertDiskMatchesRows();
    });
  });

  // ------------------------------------------------------------ 4. tên file độc
  describe('Tên file độc (path traversal, ký tự điều khiển, quá dài, Unicode)', () => {
    for (const filename of HOSTILE_FILENAMES) {
      it(`tên ${JSON.stringify(filename.length > 40 ? `${filename.slice(0, 40)}…(${filename.length})` : filename)} → nhận PNG, tên đã làm sạch`, async () => {
        const png = buildPng();
        const res = await upload({ buffer: png, filename, contentType: 'image/png' });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        await assertUploadInvariants(res, png, `name:${filename.slice(0, 20)}`);
        const [row] = [...mediaRepo.rows.values()];
        // Khóa lưu trữ sinh ngẫu nhiên, không chứa gì từ tên file.
        assert.match(row.storageKey, /^uploads\/[\w/-]+\.png$/);
        if (row.originalName !== null) {
          assert.ok(!/[/\\]/.test(row.originalName), `tên còn dấu phân cách đường dẫn: ${row.originalName}`);
          // eslint-disable-next-line no-control-regex
          assert.ok(!/[\u0000-\u001f\u007f]/.test(row.originalName), 'tên còn ký tự điều khiển');
          assert.ok(Array.from(row.originalName).length <= 255, 'tên dài quá 255 ký tự');
        }
      });
    }
  });

  // ------------------------------------------------------------ 5. multipart dị dạng
  /** Lỗi multer/busboy phải theo envelope chuẩn với thông điệp tiếng Việt (không lộ "Unexpected field"...). */
  function assertMultipartError(res: request.Response, messagePart: string) {
    assert.equal(res.body.success, false);
    assert.equal(res.body.errors?.[0]?.field, 'file', JSON.stringify(res.body));
    assert.equal(res.body.errors[0].code, MediaErrorCode.INVALID_MULTIPART);
    assert.ok(res.body.message.includes(messagePart), `thông điệp "${res.body.message}" thiếu "${messagePart}"`);
  }

  describe('Multipart dị dạng', () => {
    it('tên file chứa NUL → busboy từ chối header → 400 media_invalid_multipart, không tạo media', async () => {
      const res = await upload({ buffer: buildPng(), filename: 'a\u0000b.png', contentType: 'image/png' });
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assertMultipartError(res, 'cắt cụt');
      assert.equal(mediaRepo.rows.size, 0);
      await assertDiskMatchesRows();
    });

    it('job: sai tên field → 400 cùng envelope, không tạo job', async () => {
      const res = await http().post('/admin/media/upload-jobs').set('Idempotency-Key', randomUUID())
        .attach('upload', buildPng(), 'a.png');
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assertMultipartError(res, 'trường "file"');
      assert.equal(jobRepo.rows.size, 0);
    });

    it('không có file → 400 media_file_required', async () => {
      const res = await http().post('/admin/media/upload').field('altText', 'x');
      assert.equal(res.status, 400);
      assert.equal(res.body.errors[0].code, MediaErrorCode.FILE_REQUIRED);
      assert.equal(mediaRepo.rows.size, 0);
    });

    it('body JSON thay vì multipart → 400, không 5xx', async () => {
      const res = await http().post('/admin/media/upload').send({ file: 'iVBORw0KGgo=' });
      assert.equal(res.status, 400);
      assert.equal(mediaRepo.rows.size, 0);
    });

    it('sai tên field ("upload" thay vì "file") → 400', async () => {
      const res = await http().post('/admin/media/upload').attach('upload', buildPng(), 'a.png');
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assertMultipartError(res, 'trường "file"');
      assert.equal(mediaRepo.rows.size, 0);
      await assertDiskMatchesRows();
    });

    it('hai file trong một request → 4xx, không lưu file nào', async () => {
      const res = await http().post('/admin/media/upload')
        .attach('file', buildPng(), 'a.png').attach('file', buildPng(), 'b.png');
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assertMultipartError(res, 'một file');
      assert.equal(mediaRepo.rows.size, 0);
      await assertDiskMatchesRows();
    });

    it('field lạ ngoài DTO → 400 (forbidNonWhitelisted), không lưu file', async () => {
      const res = await http().post('/admin/media/upload').field('storageKey', '../../etc/passwd')
        .attach('file', buildPng(), 'a.png');
      assert.equal(res.status, 400);
      assert.equal(mediaRepo.rows.size, 0);
      await assertDiskMatchesRows();
    });

    it('quá nhiều field (> 10) → 4xx, không 5xx', async () => {
      let req = http().post('/admin/media/upload');
      for (let i = 0; i < 12; i += 1) req = req.field(`f${i}`, 'x');
      const res = await req.attach('file', buildPng(), 'a.png');
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assertMultipartError(res, 'quá nhiều trường');
      assert.equal(mediaRepo.rows.size, 0);
    });

    it('multipart bị cắt cụt (thiếu boundary kết thúc) → 400, không 5xx', async () => {
      const body = Buffer.concat([
        Buffer.from('--XYZ\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n'),
        buildPng().subarray(0, 20),
      ]);
      const res = await http().post('/admin/media/upload').set('Content-Type', 'multipart/form-data; boundary=XYZ').send(body);
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assertMultipartError(res, 'cắt cụt');
      assert.equal(mediaRepo.rows.size, 0);
      await assertDiskMatchesRows();
    });

    it('multipart không có boundary → 400, không 5xx', async () => {
      const res = await http().post('/admin/media/upload').set('Content-Type', 'multipart/form-data').send('abc');
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assertMultipartError(res, 'cắt cụt');
      assert.equal(mediaRepo.rows.size, 0);
    });
  });

  // ------------------------------------------------------------ 6. giữ nguyên media cũ (AC-33)
  describe('Upload lỗi không ảnh hưởng media đã có', () => {
    it('media A còn nguyên (bản ghi + nội dung tải về) sau loạt upload độc, cả đồng bộ lẫn job', async () => {
      const original = buildPng();
      const seeded = await upload({ buffer: original, filename: 'goc.png', contentType: 'image/png' }).expect(201);
      const id = seeded.body.data.id;
      const snapshot = { ...mediaRepo.rows.get(id) };

      // Một số biến thể đột biến vẫn là file hợp lệ: chúng được nhận thành media MỚI, không đụng A.
      const accepted: string[] = [];
      for (const c of [...HOSTILE_FILES, ...mutatedCases(SEED + 1, 5)]) {
        const res = await upload(c);
        assert.ok(ALLOWED_STATUS.has(res.status), `${c.label}: ${res.status}`);
        if (res.status === 201) accepted.push(res.body.data.id);
        await jobOutcome(c, accepted);
      }

      assert.deepEqual({ ...mediaRepo.rows.get(id) }, snapshot, 'bản ghi media A không được đổi');
      const content = await http().get(`/admin/media/${id}/content`).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      assert.equal(content.status, 200);
      assert.equal(sha256(content.body as Buffer), sha256(original), 'nội dung media A phải còn nguyên');
      assert.deepEqual(readyIds().sort(), [id, ...accepted].sort(), 'media READY chỉ gồm A và các file hợp lệ được nhận');
      await assertDiskMatchesRows();
    });
  });

  // ------------------------------------------------------------ 7. đồng thời
  describe('Upload đồng thời lẫn file hợp lệ và file độc', () => {
    it('40 request song song → mỗi file hợp lệ đúng 1 media, file độc 0 media, đĩa khớp bản ghi', async () => {
      const valid = Array.from({ length: 10 }, () => ({ buffer: buildPng(), filename: 'ok.png', contentType: 'image/png' }));
      const hostile = [...HOSTILE_FILES, ...mutatedCases(SEED + 2, 2)].slice(0, 30);
      const all = [...valid.map((c) => ({ ...c, ok: true })), ...hostile.map((c) => ({ ...c, ok: false }))];
      const results = await Promise.all(all.map((c) => upload(c)));
      results.forEach((res, i) => {
        assert.ok(ALLOWED_STATUS.has(res.status), `${i}: ${res.status}`);
        if (all[i].ok) assert.equal(res.status, 201);
      });
      const accepted = results.filter((res) => res.status === 201).map((res) => res.body.data.id);
      assert.deepEqual(readyIds().sort(), accepted.sort(), 'mỗi response 201 tương ứng đúng 1 media READY');
      await assertDiskMatchesRows();
    });
  });
});
