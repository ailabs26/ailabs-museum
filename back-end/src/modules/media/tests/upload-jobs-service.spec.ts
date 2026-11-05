import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { QueryFailedError, Repository } from 'typeorm';
import { toUploadJobResponse } from '../dto/upload-job-response.dto';
import { MediaUploadJob, UPLOAD_JOB_ACTOR_KEY_CONSTRAINT, UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MediaService } from '../services/media.service';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { AuditService } from '../../audit/services/audit.service';
import {
  FailingStorage,
  FakeAuditRepository,
  FakeMediaRepository,
  FakeTransactionManager,
  FakeUploadJobRepository,
  testMediaUrlService,
} from './media-test-doubles';
import { buildGlb } from './media-test-files';

const ACTOR = 'b0000000-0000-4000-8000-000000000002';

describe('MediaUploadJobService (unit, VT-078)', () => {
  let workDir: string;
  let storage: FailingStorage;
  let mediaRepo: FakeMediaRepository;
  let jobRepo: FakeUploadJobRepository;
  let service: MediaUploadJobService;

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'upload-jobs-unit-'));
  });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    storage = new FailingStorage({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'quarantine') });
    mediaRepo = new FakeMediaRepository();
    jobRepo = new FakeUploadJobRepository();
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
      new AuditService(new FakeAuditRepository() as unknown as AuditRepository),
    );
  });

  const glb = () => ({ buffer: buildGlb(), originalname: 'tuong-phat.glb' });

  it('TC09 — failure path: storage lỗi → job failed (internal_error, không lộ chi tiết); retry cùng key trả job failed cũ, không chạy lại pipeline', async () => {
    storage.saveError = new Error('ECONNRESET supabase://bucket/secret-path');
    const key = randomUUID();

    const first = await service.enqueue(glb(), {}, ACTOR, key);
    assert.equal(first.created, true);
    await service.whenIdle();

    const failed = jobRepo.rows.get(first.job.id)!;
    assert.equal(failed.status, UploadJobStatus.FAILED);
    assert.equal(failed.errorCode, 'internal_error');
    assert.doesNotMatch(failed.errorMessage ?? '', /supabase|secret/);
    assert.equal(mediaRepo.rows.size, 0);

    // Hạ tầng hồi phục nhưng client gửi lại đúng key cũ: vẫn là job cũ, không tạo media mới.
    storage.saveError = undefined;
    const patchesBefore = jobRepo.patches.length;
    const retry = await service.enqueue(glb(), {}, ACTOR, key);
    await service.whenIdle();
    assert.equal(retry.created, false);
    assert.equal(retry.job.id, first.job.id);
    assert.equal(retry.job.status, UploadJobStatus.FAILED);
    assert.equal(jobRepo.patches.length, patchesBefore, 'retry không được chạy lại worker');
    assert.equal(mediaRepo.rows.size, 0);
    assert.equal(jobRepo.rows.size, 1);

    // Muốn thử lại thật sự thì dùng key mới.
    const fresh = await service.enqueue(glb(), {}, ACTOR, randomUUID());
    await service.whenIdle();
    assert.equal(jobRepo.rows.get(fresh.job.id)!.status, UploadJobStatus.SUCCEEDED);
    assert.equal(mediaRepo.rows.size, 1);
  });

  it('fingerprint gồm cả metadata: cùng key, cùng file nhưng altText khác → 409', async () => {
    const key = randomUUID();
    await service.enqueue(glb(), { altText: 'Tượng Phật' }, ACTOR, key);
    await assert.rejects(service.enqueue(glb(), { altText: 'Tượng khác' }, ACTOR, key), (error: unknown) => {
      assert.equal((error as { getStatus(): number }).getStatus(), 409);
      return true;
    });
    await service.whenIdle();
  });

  it('TC19 — media đã lưu, patch succeeded lỗi DB tạm thời 2 lần rồi thành công → job succeeded có mediaId, không ghi failed', async () => {
    service.completionRetryDelayMs = 0;
    let succeededFailures = 0;
    jobRepo.patchError = (data) =>
      data.status === UploadJobStatus.SUCCEEDED && succeededFailures++ < 2 ? new Error('connection terminated unexpectedly') : undefined;

    const { job } = await service.enqueue(glb(), {}, ACTOR, randomUUID());
    await service.whenIdle();

    const media = mediaRepo.only();
    const row = jobRepo.rows.get(job.id)!;
    assert.equal(succeededFailures, 3, 'thử 3 lần: 2 lỗi + 1 thành công');
    assert.equal(row.status, UploadJobStatus.SUCCEEDED);
    assert.equal(row.mediaId, media.id);
    assert.equal(row.errorCode, null);
    assert.ok(!jobRepo.patches.some((p) => p.data.status === UploadJobStatus.FAILED), 'không được có patch failed');
  });

  it('TC19b — media đã lưu, patch succeeded lỗi liên tục → media vẫn còn, job giữ processing, không ghi failed; retry cùng key không chạy lại worker', async () => {
    service.completionRetryDelayMs = 0;
    let succeededAttempts = 0;
    jobRepo.patchError = (data) => {
      if (data.status !== UploadJobStatus.SUCCEEDED) return undefined;
      succeededAttempts++;
      return new Error('connection terminated unexpectedly');
    };
    const key = randomUUID();

    const { job } = await service.enqueue(glb(), {}, ACTOR, key);
    await service.whenIdle();

    const media = mediaRepo.only();
    assert.equal(media.isDeleted, false);
    assert.deepEqual(storage.removed, [], 'không được xóa file media đã lưu');
    assert.equal(succeededAttempts, 3);
    const row = jobRepo.rows.get(job.id)!;
    assert.equal(row.status, UploadJobStatus.PROCESSING);
    assert.equal(row.errorCode, null);
    assert.ok(!jobRepo.patches.some((p) => p.data.status === UploadJobStatus.FAILED), 'không được có patch failed');

    const patchesBefore = jobRepo.patches.length;
    const retry = await service.enqueue(glb(), {}, ACTOR, key);
    await service.whenIdle();
    assert.equal(retry.created, false);
    assert.equal(jobRepo.patches.length, patchesBefore);
    assert.equal(mediaRepo.rows.size, 1, 'retry không tạo media thứ hai');
  });

  it('TC13 — khởi động lại: job queued/processing → failed job_interrupted; job đã xong giữ nguyên', async () => {
    const queued = jobRepo.seed({ status: UploadJobStatus.QUEUED });
    const processing = jobRepo.seed({ status: UploadJobStatus.PROCESSING, progress: 50 });
    const done = jobRepo.seed({ status: UploadJobStatus.SUCCEEDED, progress: 100, mediaId: randomUUID() });

    await service.onApplicationBootstrap();

    assert.equal(jobRepo.rows.get(queued.id)!.status, UploadJobStatus.FAILED);
    assert.equal(jobRepo.rows.get(processing.id)!.errorCode, 'job_interrupted');
    assert.equal(jobRepo.rows.get(done.id)!.status, UploadJobStatus.SUCCEEDED);
  });
});

describe('toUploadJobResponse (unit) — TC10', () => {
  it('ánh xạ đúng từng field, không lộ checksum/key/người tạo', () => {
    const job = Object.assign(new MediaUploadJob(), {
      id: '11111111-1111-4111-8111-111111111111',
      createdById: ACTOR,
      idempotencyKey: 'client-key-1',
      requestChecksum: 'c'.repeat(64),
      status: UploadJobStatus.SUCCEEDED,
      progress: 100,
      mediaId: '22222222-2222-4222-8222-222222222222',
      errorCode: null,
      errorMessage: null,
      createdAt: new Date('2026-10-31T01:00:00Z'),
      updatedAt: new Date('2026-10-31T01:00:02Z'),
    });

    assert.deepEqual(toUploadJobResponse(job), {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'succeeded',
      progress: 100,
      mediaId: '22222222-2222-4222-8222-222222222222',
      errorCode: null,
      errorMessage: null,
      createdAt: new Date('2026-10-31T01:00:00Z'),
      updatedAt: new Date('2026-10-31T01:00:02Z'),
    });
  });

  it('job failed giữ errorCode/errorMessage, mediaId null', () => {
    const job = Object.assign(new MediaUploadJob(), {
      id: randomUUID(),
      status: UploadJobStatus.FAILED,
      progress: 100,
      mediaId: null,
      errorCode: 'media_corrupted',
      errorMessage: 'GLB hỏng',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = toUploadJobResponse(job);
    assert.equal(res.errorCode, 'media_corrupted');
    assert.equal(res.errorMessage, 'GLB hỏng');
    assert.equal(res.mediaId, null);
  });
});

describe('MediaUploadJobRepository.insertOrFindExisting (unit, lỗi 23505)', () => {
  const data = { createdById: ACTOR, idempotencyKey: 'k-1', requestChecksum: 'a'.repeat(64) };
  const existing = Object.assign(new MediaUploadJob(), { ...data, id: randomUUID(), status: UploadJobStatus.QUEUED });

  function repoWith(saveError: unknown) {
    const calls: unknown[] = [];
    const typeorm = {
      create: (value: Partial<MediaUploadJob>) => Object.assign(new MediaUploadJob(), value),
      save: async (value: MediaUploadJob) => {
        if (saveError) throw saveError;
        return Object.assign(value, { id: randomUUID() });
      },
      findOne: async (options: unknown) => {
        calls.push(options);
        return existing;
      },
    };
    return { repo: new MediaUploadJobRepository(typeorm as unknown as Repository<MediaUploadJob>), calls };
  }

  const uniqueViolation = (constraint: string) =>
    new QueryFailedError('INSERT ...', [], Object.assign(new Error('duplicate key'), { code: '23505', constraint }));

  it('insert thành công → created true', async () => {
    const { repo } = repoWith(undefined);
    const result = await repo.insertOrFindExisting(data);
    assert.equal(result.created, true);
  });

  it('vi phạm UQ actor+key (request đồng thời thắng trước) → đọc lại job đã có, created false', async () => {
    const { repo, calls } = repoWith(uniqueViolation(UPLOAD_JOB_ACTOR_KEY_CONSTRAINT));
    const result = await repo.insertOrFindExisting(data);
    assert.equal(result.created, false);
    assert.equal(result.job.id, existing.id);
    assert.deepEqual(calls, [{ where: { createdById: ACTOR, idempotencyKey: 'k-1' } }]);
  });

  it('vi phạm constraint khác hoặc lỗi DB khác → ném lại, không nuốt lỗi', async () => {
    await assert.rejects(repoWith(uniqueViolation('PK_other')).repo.insertOrFindExisting(data), QueryFailedError);
    await assert.rejects(repoWith(new Error('connection lost')).repo.insertOrFindExisting(data), /connection lost/);
  });
});
