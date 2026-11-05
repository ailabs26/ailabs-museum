import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { AuditService } from '../../audit/services/audit.service';
import { UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MediaService } from '../services/media.service';
import {
  FailingStorage,
  FakeAuditRepository,
  FakeMediaRepository,
  FakeTransactionManager,
  FakeUploadJobRepository,
  testMediaUrlService,
} from './media-test-doubles';
import { EXE_FILE, buildGlb } from './media-test-files';

/**
 * Review BT3: media tạo qua upload-jobs phải có audit `media.upload` như đường upload đồng bộ.
 * `AuditService` là bản thật trên repository fake để chạy đúng đường `recordSafely`.
 */

const ACTOR = 'b0000000-0000-4000-8000-000000000002';
const UPLOAD_ACTION = 'media.upload';

describe('Audit media.upload của worker upload-jobs', () => {
  let workDir: string;
  let storage: FailingStorage;
  let mediaRepo: FakeMediaRepository;
  let jobRepo: FakeUploadJobRepository;
  let auditRepo: FakeAuditRepository;
  let service: MediaUploadJobService;

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'upload-jobs-audit-'));
  });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    storage = new FailingStorage({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'quarantine') });
    mediaRepo = new FakeMediaRepository();
    jobRepo = new FakeUploadJobRepository();
    auditRepo = new FakeAuditRepository();
    const mediaService = new MediaService(
      mediaRepo as unknown as MediaRepository,
      storage,
      new MediaInspectionService(),
      new FakeTransactionManager() as unknown as TransactionManager,
      testMediaUrlService(),
    );
    service = new MediaUploadJobService(
      jobRepo as unknown as MediaUploadJobRepository,
      mediaService,
      new AuditService(auditRepo as unknown as AuditRepository),
    );
    service.completionRetryDelayMs = 0;
  });

  const glb = () => ({ buffer: buildGlb(), originalname: 'tuong-phat.glb' });

  it('TC20 — job succeeded → đúng 1 audit media.upload: resource là media vừa tạo, actor là người tạo job, giữ client info', async () => {
    const client = { requestId: 'req-tc20', ip: '10.0.0.7', userAgent: 'tc20-agent' };
    const { job } = await service.enqueue(glb(), {}, ACTOR, randomUUID(), client);
    await service.whenIdle();

    const media = mediaRepo.only();
    assert.equal(jobRepo.rows.get(job.id)!.status, UploadJobStatus.SUCCEEDED);
    const rows = auditRepo.byAction(UPLOAD_ACTION);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].resourceType, 'media');
    assert.equal(rows[0].resourceId, media.id);
    assert.equal(rows[0].actorId, ACTOR);
    assert.equal(rows[0].requestId, 'req-tc20');
    assert.equal(rows[0].ip, '10.0.0.7');
    assert.equal(rows[0].userAgent, 'tc20-agent');
  });

  it('TC20b — không có client info (gọi ngoài HTTP) vẫn ghi audit với requestId sinh mới', async () => {
    await service.enqueue(glb(), {}, ACTOR, randomUUID());
    await service.whenIdle();

    const [row] = auditRepo.byAction(UPLOAD_ACTION);
    assert.ok(row?.requestId, 'cột request_id NOT NULL nên luôn phải có giá trị');
    assert.equal(row.ip, null);
  });

  it('TC21 — failure path: ghi audit lỗi → job vẫn succeeded có mediaId, không có patch failed', async () => {
    auditRepo.saveError = new Error('audit table unavailable');

    const { job } = await service.enqueue(glb(), {}, ACTOR, randomUUID());
    await service.whenIdle();

    const row = jobRepo.rows.get(job.id)!;
    assert.equal(row.status, UploadJobStatus.SUCCEEDED);
    assert.equal(row.mediaId, mediaRepo.only().id);
    assert.ok(!jobRepo.patches.some((p) => p.data.status === UploadJobStatus.FAILED));
  });

  it('TC22 — negative: job failed (file bị từ chối, storage lỗi) → không có audit media.upload', async () => {
    const rejected = await service.enqueue({ buffer: EXE_FILE, originalname: 'virus.glb' }, {}, ACTOR, randomUUID());
    storage.saveError = new Error('ECONNRESET');
    const storageFailed = await service.enqueue(glb(), {}, ACTOR, randomUUID());
    await service.whenIdle();

    assert.equal(jobRepo.rows.get(rejected.job.id)!.status, UploadJobStatus.FAILED);
    assert.equal(jobRepo.rows.get(storageFailed.job.id)!.status, UploadJobStatus.FAILED);
    assert.deepEqual(auditRepo.byAction(UPLOAD_ACTION), []);
  });

  it('TC23 — risk: retry cùng key (tuần tự sau khi xong và 20 request đồng thời) chỉ có 1 audit media.upload', async () => {
    const key = randomUUID();
    await Promise.all(Array.from({ length: 20 }, () => service.enqueue(glb(), {}, ACTOR, key)));
    await service.whenIdle();
    const retry = await service.enqueue(glb(), {}, ACTOR, key);
    await service.whenIdle();

    assert.equal(retry.created, false);
    assert.equal(mediaRepo.rows.size, 1);
    assert.equal(auditRepo.byAction(UPLOAD_ACTION).length, 1);
  });

  it('TC24 — ghi succeeded lỗi 2 lần rồi được: chỉ 1 audit, không ghi theo số lần thử', async () => {
    let failures = 0;
    jobRepo.patchError = (data) =>
      data.status === UploadJobStatus.SUCCEEDED && failures++ < 2 ? new Error('connection terminated unexpectedly') : undefined;

    await service.enqueue(glb(), {}, ACTOR, randomUUID());
    await service.whenIdle();

    assert.equal(auditRepo.byAction(UPLOAD_ACTION).length, 1);
  });

  it('TC24b — media đã lưu nhưng không ghi được succeeded: job giữ processing, media có thật nên vẫn có audit', async () => {
    jobRepo.patchError = (data) => (data.status === UploadJobStatus.SUCCEEDED ? new Error('connection terminated unexpectedly') : undefined);

    const { job } = await service.enqueue(glb(), {}, ACTOR, randomUUID());
    await service.whenIdle();

    assert.equal(jobRepo.rows.get(job.id)!.status, UploadJobStatus.PROCESSING);
    const rows = auditRepo.byAction(UPLOAD_ACTION);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].resourceId, mediaRepo.only().id);
  });
});
