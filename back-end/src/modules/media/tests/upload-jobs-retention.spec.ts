import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { validateEnvironment } from '../../../config/env.validation';
import { mediaConfig } from '../../../config/media.config';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { AuditService } from '../../audit/services/audit.service';
import { UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MediaService } from '../services/media.service';
import { FakeAuditRepository, FakeUploadJobRepository, GatedMediaService, testUploadJobConfig } from './media-test-doubles';

/** Review BT3: dọn job đã kết thúc khi khởi động, không cần scheduler. */

const NOW = new Date('2026-11-05T00:00:00Z');
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

describe('Dọn media_upload_jobs khi khởi động', () => {
  let jobRepo: FakeUploadJobRepository;

  function build(media: Record<string, number> = {}): MediaUploadJobService {
    return new MediaUploadJobService(
      jobRepo as unknown as MediaUploadJobRepository,
      new GatedMediaService() as unknown as MediaService,
      new AuditService(new FakeAuditRepository() as unknown as AuditRepository),
      testUploadJobConfig(media),
    );
  }

  beforeEach(() => {
    jobRepo = new FakeUploadJobRepository();
    mock.timers.enable({ apis: ['Date'], now: NOW });
  });

  afterEach(() => mock.timers.reset());

  it('TC35 — mặc định 7 ngày: xóa job succeeded/failed cũ hơn mốc; job tại đúng mốc, job mới và job gián đoạn được giữ', async () => {
    const oldSucceeded = jobRepo.seed({ status: UploadJobStatus.SUCCEEDED, updatedAt: daysAgo(8) });
    const oldFailed = jobRepo.seed({ status: UploadJobStatus.FAILED, updatedAt: daysAgo(8) });
    const atCutoff = jobRepo.seed({ status: UploadJobStatus.SUCCEEDED, updatedAt: daysAgo(7) });
    const recent = jobRepo.seed({ status: UploadJobStatus.FAILED, updatedAt: daysAgo(1) });
    const interrupted = jobRepo.seed({ status: UploadJobStatus.QUEUED, updatedAt: daysAgo(30) });

    await build().onApplicationBootstrap();

    assert.deepEqual(jobRepo.deleteCutoffs, [daysAgo(7)]);
    assert.equal(jobRepo.rows.has(oldSucceeded.id), false);
    assert.equal(jobRepo.rows.has(oldFailed.id), false);
    assert.ok(jobRepo.rows.has(atCutoff.id));
    assert.ok(jobRepo.rows.has(recent.id));
    assert.equal(jobRepo.rows.get(interrupted.id)?.errorCode, 'job_interrupted');
  });

  it('TC35c — số ngày lấy từ cấu hình', async () => {
    await build({ uploadJobRetentionDays: 30 }).onApplicationBootstrap();
    assert.deepEqual(jobRepo.deleteCutoffs, [daysAgo(30)]);
  });

  it('TC36 — failure path: dọn job lỗi → khởi động vẫn thành công, failInterrupted vẫn đã chạy', async () => {
    jobRepo.deleteError = new Error('connection terminated unexpectedly');
    const running = jobRepo.seed({ status: UploadJobStatus.PROCESSING });

    await assert.doesNotReject(build().onApplicationBootstrap());

    assert.equal(jobRepo.rows.get(running.id)?.errorCode, 'job_interrupted');
  });

  it('TC36b — failure path: failInterrupted lỗi → vẫn dọn job cũ, khởi động không hỏng', async () => {
    jobRepo.failInterruptedError = new Error('connection terminated unexpectedly');
    const old = jobRepo.seed({ status: UploadJobStatus.SUCCEEDED, updatedAt: daysAgo(8) });

    await assert.doesNotReject(build().onApplicationBootstrap());

    assert.equal(jobRepo.rows.has(old.id), false);
  });
});

describe('Cấu hình MEDIA_UPLOAD_JOB_RETENTION_DAYS', () => {
  const BASE = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };
  const saved = process.env.MEDIA_UPLOAD_JOB_RETENTION_DAYS;

  afterEach(() => {
    if (saved === undefined) delete process.env.MEDIA_UPLOAD_JOB_RETENTION_DAYS;
    else process.env.MEDIA_UPLOAD_JOB_RETENTION_DAYS = saved;
  });

  it('TC37 — media.config: mặc định 7, đọc được env', () => {
    delete process.env.MEDIA_UPLOAD_JOB_RETENTION_DAYS;
    assert.equal(mediaConfig().uploadJobRetentionDays, 7);
    process.env.MEDIA_UPLOAD_JOB_RETENTION_DAYS = '14';
    assert.equal(mediaConfig().uploadJobRetentionDays, 14);
  });

  it('TC37b — negative: env.validation từ chối 0, số âm, số lẻ, chữ; nhận biên 1 và 3650', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '3651']) {
      assert.throws(() => validateEnvironment({ ...BASE, MEDIA_UPLOAD_JOB_RETENTION_DAYS: value }), /MEDIA_UPLOAD_JOB_RETENTION_DAYS/, value);
    }
    for (const value of ['1', '3650']) {
      assert.equal(validateEnvironment({ ...BASE, MEDIA_UPLOAD_JOB_RETENTION_DAYS: value }).MEDIA_UPLOAD_JOB_RETENTION_DAYS, Number(value));
    }
    assert.equal(validateEnvironment(BASE).MEDIA_UPLOAD_JOB_RETENTION_DAYS, 7);
  });
});
