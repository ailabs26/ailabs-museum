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
import { MediaProcessingState } from '../entities/media.entity';
import { UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaRepository } from '../repositories/media.repository';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MediaUrlService } from '../services/media-url.service';
import { MediaService } from '../services/media.service';
import {
  ControllableInspection,
  FAKE_MANAGER,
  FailingStorage,
  FakeAuditRepository,
  FakeMediaRepository,
  FakeTransactionManager,
  FakeUploadJobRepository,
  testMediaUrlService,
  testUploadJobConfig,
} from './media-test-doubles';
import { buildGlb } from './media-test-files';

/**
 * Review P2 (PR #133): media đã lưu thì job không được kết thúc `failed`. Liên kết job↔media ghi
 * cùng transaction với media, nên restart đối soát được từ database. Tính nguyên tử thật nằm ở
 * TC38-DB, TC41-DB, TC43-DB; file này kiểm luồng và các nhánh lỗi khó dựng trên database.
 */

const ACTOR = 'b0000000-0000-4000-8000-000000000002';
const UPLOAD_ACTION = 'media.upload';
const DB_DOWN = new Error('connection terminated unexpectedly');

describe('Đối soát job upload với media đã lưu', () => {
  let workDir: string;
  let storage: FailingStorage;
  let inspection: ControllableInspection;
  let mediaRepo: FakeMediaRepository;
  let jobRepo: FakeUploadJobRepository;
  let auditRepo: FakeAuditRepository;
  let tx: FakeTransactionManager;
  let urls: MediaUrlService;
  let media: MediaService;

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'upload-jobs-reconcile-'));
  });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    storage = new FailingStorage({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'quarantine') });
    inspection = new ControllableInspection();
    mediaRepo = new FakeMediaRepository();
    jobRepo = new FakeUploadJobRepository();
    auditRepo = new FakeAuditRepository();
    tx = new FakeTransactionManager();
    urls = testMediaUrlService();
    media = new MediaService(
      mediaRepo as unknown as MediaRepository,
      storage,
      inspection,
      tx as unknown as TransactionManager,
      urls,
    );
  });

  /** Mỗi lần gọi là một "tiến trình" mới trên cùng repository. */
  function startService(): MediaUploadJobService {
    const service = new MediaUploadJobService(
      jobRepo as unknown as MediaUploadJobRepository,
      media,
      new AuditService(auditRepo as unknown as AuditRepository),
      testUploadJobConfig(),
    );
    service.completionRetryDelayMs = 0;
    return service;
  }

  const glb = () => ({ buffer: buildGlb(), originalname: 'tuong-phat.glb' });
  const row = (id: string) => jobRepo.rows.get(id)!;
  const failSucceeded = () => {
    jobRepo.patchError = (data) => (data.status === UploadJobStatus.SUCCEEDED ? DB_DOWN : undefined);
  };

  it('TC38 — review P2: upload thành công → 3 lần ghi succeeded lỗi → restart → retry cùng key: job succeeded có mediaId, không chạy lại worker, không có media thứ hai', async () => {
    failSucceeded();
    const key = randomUUID();
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, ACTOR, key);
    await worker.whenIdle();

    const saved = mediaRepo.only();
    assert.equal(row(job.id).status, UploadJobStatus.PROCESSING);
    assert.equal(row(job.id).mediaId, saved.id, 'liên kết phải nằm trong job, không chỉ trong log');

    jobRepo.patchError = undefined;
    const restarted = startService();
    await restarted.onApplicationBootstrap();

    assert.equal(row(job.id).status, UploadJobStatus.SUCCEEDED);
    assert.equal(row(job.id).mediaId, saved.id);
    assert.equal(row(job.id).progress, 100);
    assert.equal(row(job.id).errorCode, null);
    assert.equal(row(job.id).errorMessage, null);

    const patchesBefore = jobRepo.patches.length;
    const retry = await restarted.enqueue(glb(), {}, ACTOR, key);
    await restarted.whenIdle();
    assert.equal(retry.created, false);
    assert.equal(retry.job.id, job.id);
    assert.equal(retry.job.status, UploadJobStatus.SUCCEEDED);
    assert.equal(retry.job.mediaId, saved.id);
    assert.equal(jobRepo.patches.length, patchesBefore, 'retry không được chạy lại worker');
    assert.equal(mediaRepo.rows.size, 1, 'retry không tạo media thứ hai');
    assert.equal(auditRepo.byAction(UPLOAD_ACTION).length, 1, 'đối soát không ghi audit lần nữa');
  });

  it('TC38b — retry cùng key khi job còn kẹt processing (chưa restart): trả job cũ đã có mediaId, không chạy lại worker', async () => {
    failSucceeded();
    const key = randomUUID();
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, ACTOR, key);
    await worker.whenIdle();

    const retry = await worker.enqueue(glb(), {}, ACTOR, key);
    await worker.whenIdle();
    assert.equal(retry.created, false);
    assert.equal(retry.job.id, job.id);
    assert.equal(retry.job.mediaId, mediaRepo.only().id);
  });

  it('TC39 — khởi động: job không có media vẫn failed job_interrupted như cũ; job có media thành succeeded', async () => {
    const processing = jobRepo.seed({ status: UploadJobStatus.PROCESSING, progress: 50 });
    const queued = jobRepo.seed({ status: UploadJobStatus.QUEUED });
    const linked = jobRepo.seed({ status: UploadJobStatus.PROCESSING, progress: 50, mediaId: randomUUID() });

    await startService().onApplicationBootstrap();

    assert.equal(row(processing.id).errorCode, 'job_interrupted');
    assert.equal(row(queued.id).errorCode, 'job_interrupted');
    assert.equal(row(linked.id).status, UploadJobStatus.SUCCEEDED);
    assert.equal(row(linked.id).errorCode, null);
  });

  it('TC40 — negative: media bị cách ly không được liên kết: job failed media_quarantined, mediaId null', async () => {
    inspection.structureError = new Error('parser nổ');
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, ACTOR, randomUUID());
    await worker.whenIdle();

    assert.equal(mediaRepo.only().processingState, MediaProcessingState.QUARANTINED);
    assert.equal(row(job.id).status, UploadJobStatus.FAILED);
    assert.equal(row(job.id).errorCode, 'media_quarantined');
    assert.equal(row(job.id).mediaId, null);
    assert.deepEqual(jobRepo.links, []);
  });

  it('TC41 — failure path: ghi liên kết lỗi → upload coi là thất bại: file bị dọn, job failed không có mediaId', async () => {
    jobRepo.linkError = DB_DOWN;
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, ACTOR, randomUUID());
    await worker.whenIdle();

    assert.equal(storage.removed.length, 1, 'file đã ghi phải được dọn khi transaction hỏng');
    assert.equal(row(job.id).status, UploadJobStatus.FAILED);
    assert.equal(row(job.id).errorCode, 'internal_error');
    assert.equal(row(job.id).mediaId, null);
    assert.deepEqual(auditRepo.byAction(UPLOAD_ACTION), []);
  });

  it('TC42 — transaction đã commit nhưng upload() vẫn ném lỗi sau đó: job không bị ghi failed, thành succeeded và có audit', async () => {
    urls.signedUrl = () => {
      throw new Error('không ký được URL');
    };
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, ACTOR, randomUUID());
    await worker.whenIdle();

    const saved = mediaRepo.only();
    assert.equal(row(job.id).status, UploadJobStatus.SUCCEEDED);
    assert.equal(row(job.id).mediaId, saved.id);
    assert.equal(row(job.id).errorCode, null);
    assert.ok(!jobRepo.patches.some((patch) => patch.data.status === UploadJobStatus.FAILED));
    assert.equal(auditRepo.byAction(UPLOAD_ACTION)[0]?.resourceId, saved.id);
  });

  it('TC44 — liên kết chạy cùng transaction với media; đường upload đồng bộ không mở transaction', async () => {
    const worker = startService();
    await worker.enqueue(glb(), {}, ACTOR, randomUUID());
    await worker.whenIdle();
    assert.equal(tx.runs, 1);
    assert.deepEqual(mediaRepo.saveManagers, [FAKE_MANAGER]);
    assert.equal(jobRepo.links[0]?.manager, FAKE_MANAGER);

    tx.runs = 0;
    mediaRepo.saveManagers = [];
    await media.upload(glb(), {}, ACTOR);
    assert.equal(tx.runs, 0);
    assert.deepEqual(mediaRepo.saveManagers, [undefined]);
  });

  it('TC45 — failure path: bước đối soát lỗi lúc khởi động → job có media vẫn không bị failed, lần khởi động sau thành succeeded', async () => {
    const linked = jobRepo.seed({ status: UploadJobStatus.PROCESSING, progress: 50, mediaId: randomUUID() });
    const orphan = jobRepo.seed({ status: UploadJobStatus.PROCESSING, progress: 50 });
    jobRepo.completeLinkedError = DB_DOWN;

    await assert.doesNotReject(startService().onApplicationBootstrap());
    assert.equal(row(linked.id).status, UploadJobStatus.PROCESSING);
    assert.equal(row(orphan.id).errorCode, 'job_interrupted');

    jobRepo.completeLinkedError = undefined;
    await startService().onApplicationBootstrap();
    assert.equal(row(linked.id).status, UploadJobStatus.SUCCEEDED);
  });
});
