import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { mediaConfig } from '../../../config/media.config';
import { validateEnvironment } from '../../../config/env.validation';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { AuditService } from '../../audit/services/audit.service';
import { UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MediaService } from '../services/media.service';
import { FakeAuditRepository, FakeUploadJobRepository, GatedMediaService, testUploadJobConfig } from './media-test-doubles';

/**
 * Review BT3: giới hạn số job chạy cùng lúc bằng hàng đợi FIFO trong tiến trình.
 * `GatedMediaService` để test tự mở từng job, nên không có sleep và thứ tự là xác định.
 */

const ACTOR = 'b0000000-0000-4000-8000-000000000002';
const DB_DOWN = new Error('connection terminated unexpectedly');
/** Timeout từng test: job kẹt làm đúng test đó đỏ, không kéo theo cả suite. */
const LIMIT = { timeout: 2_000 };

/** Nhường event loop đủ lâu để mọi việc đang chờ chạy hết; dùng để khẳng định "không có gì khác xảy ra". */
async function settle(): Promise<void> {
  for (let round = 0; round < 10; round++) await new Promise((resolve) => setImmediate(resolve));
}

describe('Hàng đợi concurrency của MediaUploadJobService', () => {
  let jobRepo: FakeUploadJobRepository;
  let media: GatedMediaService;
  let service: MediaUploadJobService;

  function build(concurrency?: number, audit?: AuditService): MediaUploadJobService {
    const instance = new MediaUploadJobService(
      jobRepo as unknown as MediaUploadJobRepository,
      media as unknown as MediaService,
      audit ?? new AuditService(new FakeAuditRepository() as unknown as AuditRepository),
      testUploadJobConfig(concurrency === undefined ? {} : { uploadJobConcurrency: concurrency }),
    );
    instance.completionRetryDelayMs = 0;
    return instance;
  }

  const enqueue = (name: string, key: string = randomUUID()) =>
    service.enqueue({ buffer: Buffer.from(name), originalname: name }, {}, ACTOR, key);

  const row = (id: string) => jobRepo.rows.get(id)!;

  beforeEach(() => {
    jobRepo = new FakeUploadJobRepository();
    media = new GatedMediaService();
  });

  // Mở hết cổng để job của test này không chạy lấn sang test sau.
  afterEach(async () => {
    const stop = setInterval(() => media.releaseAll(), 1);
    await service.whenIdle();
    clearInterval(stop);
  });

  it('TC26 — 5 job, giới hạn 3: chỉ 3 job chạy; job chờ giữ queued/progress 0, không có patch; xong 1 thì job kế tiếp mới processing', LIMIT, async () => {
    service = build(3);
    const jobs = [];
    for (const name of ['a', 'b', 'c', 'd', 'e']) jobs.push((await enqueue(name)).job);

    await media.waitForStarted(3);
    await settle();
    assert.deepEqual(media.started, ['a', 'b', 'c']);
    assert.equal(row(jobs[0].id).status, UploadJobStatus.PROCESSING);
    for (const waiting of jobs.slice(3)) {
      assert.equal(row(waiting.id).status, UploadJobStatus.QUEUED);
      assert.equal(row(waiting.id).progress, 0);
      assert.ok(!jobRepo.patches.some((patch) => patch.id === waiting.id), 'job chờ không được có patch');
    }

    media.release('a');
    await media.waitForStarted(4);
    await settle();
    assert.equal(row(jobs[3].id).status, UploadJobStatus.PROCESSING);
    assert.equal(row(jobs[4].id).status, UploadJobStatus.QUEUED);

    media.release('b');
    media.release('c');
    await media.waitForStarted(5);
    media.releaseAll();
    await service.whenIdle();
    assert.equal(media.peak, 3);
    assert.ok(jobs.every((job) => row(job.id).status === UploadJobStatus.SUCCEEDED));
  });

  it('TC27 — FIFO: giới hạn 1 thì job chạy đúng thứ tự enqueue, từng job một', LIMIT, async () => {
    service = build(1);
    for (const name of ['a', 'b', 'c', 'd']) await enqueue(name);

    for (const [index, name] of ['a', 'b', 'c', 'd'].entries()) {
      await media.waitForStarted(index + 1);
      await settle();
      assert.equal(media.started.length, index + 1, 'job kế tiếp chỉ chạy sau khi job trước xong');
      media.release(name);
    }
    await service.whenIdle();
    assert.deepEqual(media.started, ['a', 'b', 'c', 'd']);
    assert.equal(media.peak, 1);
  });

  it('TC28 — whenIdle chờ cả job đang chạy lẫn job còn trong hàng đợi', LIMIT, async () => {
    service = build(1);
    await enqueue('a');
    await enqueue('b');
    await enqueue('c');
    let idle = false;
    const waiting = service.whenIdle().then(() => {
      idle = true;
    });

    await media.waitForStarted(1);
    await settle();
    assert.equal(idle, false, 'còn job đang chạy');
    media.release('a');
    await media.waitForStarted(2);
    await settle();
    assert.equal(idle, false, 'job c vẫn còn trong hàng đợi');
    media.release('b');
    await media.waitForStarted(3);
    await settle();
    assert.equal(idle, false);
    media.release('c');
    await waiting;
    assert.equal(idle, true);
    assert.equal(media.active, 0);
  });

  it('TC29 — failure path: job lỗi pipeline trả slot, job sau vẫn chạy và job lỗi là failed', LIMIT, async () => {
    service = build(1);
    const first = await enqueue('a');
    const second = await enqueue('b');

    await media.waitForStarted(1);
    media.fail('a', new Error('pipeline nổ'));
    await media.waitForStarted(2);
    media.release('b');
    await service.whenIdle();

    assert.equal(row(first.job.id).status, UploadJobStatus.FAILED);
    assert.equal(row(second.job.id).status, UploadJobStatus.SUCCEEDED);
  });

  it('TC29b — failure path: patch processing lỗi và cả patch failed cũng lỗi → slot vẫn được trả', LIMIT, async () => {
    service = build(1);
    // Đúng 2 patch của job a: processing rồi failed. Job b chạy với DB đã hồi phục.
    let failures = 0;
    jobRepo.patchError = () => (failures++ < 2 ? DB_DOWN : undefined);
    await enqueue('a');
    const second = await enqueue('b');

    await media.waitForStarted(1);
    assert.deepEqual(media.started, ['b'], 'job a không tới được pipeline nhưng không giữ slot');
    media.release('b');
    await service.whenIdle();
    assert.equal(row(second.job.id).status, UploadJobStatus.SUCCEEDED);
  });

  it('TC29c — failure path: worker ném lỗi ngoài dự kiến (sau khi media đã lưu) → slot được trả, hàng đợi không kẹt', LIMIT, async () => {
    service = build(1, { recordSafely: async () => Promise.reject(new Error('audit nổ')) } as unknown as AuditService);
    const first = await enqueue('a');
    const second = await enqueue('b');

    await media.waitForStarted(1);
    media.release('a');
    await media.waitForStarted(2);
    media.release('b');
    await service.whenIdle();

    assert.equal(row(first.job.id).status, UploadJobStatus.SUCCEEDED);
    assert.equal(row(second.job.id).status, UploadJobStatus.SUCCEEDED);
  });

  it('TC30 — retry cùng key khi job còn trong hàng đợi: trả job queued cũ, không thêm vào hàng đợi, pipeline chạy đúng 1 lần', LIMIT, async () => {
    service = build(1);
    await enqueue('a');
    const key = randomUUID();
    const first = await enqueue('b', key);
    await media.waitForStarted(1);

    const retry = await enqueue('b', key);
    assert.equal(retry.created, false);
    assert.equal(retry.job.id, first.job.id);
    assert.equal(retry.job.status, UploadJobStatus.QUEUED);

    media.release('a');
    await media.waitForStarted(2);
    media.release('b');
    await service.whenIdle();
    assert.deepEqual(media.started, ['a', 'b']);
  });

  it('TC31 — media đã lưu, ghi succeeded lỗi liên tục: job giữ processing, không ghi failed, slot được trả cho job sau', LIMIT, async () => {
    service = build(1);
    let failSucceeded = true;
    jobRepo.patchError = (data) => (failSucceeded && data.status === UploadJobStatus.SUCCEEDED ? DB_DOWN : undefined);
    const first = await enqueue('a');
    const second = await enqueue('b');

    await media.waitForStarted(1);
    media.release('a');
    await media.waitForStarted(2);
    failSucceeded = false;
    media.release('b');
    await service.whenIdle();

    assert.equal(row(first.job.id).status, UploadJobStatus.PROCESSING);
    assert.ok(!jobRepo.patches.some((patch) => patch.data.status === UploadJobStatus.FAILED));
    assert.equal(row(second.job.id).status, UploadJobStatus.SUCCEEDED);
  });

  it('TC32 — khởi động lại khi còn job processing và queued: failInterrupted đánh dấu cả hai job_interrupted', LIMIT, async () => {
    service = build(1);
    const running = await enqueue('a');
    const waiting = await enqueue('b');
    await media.waitForStarted(1);
    await settle();

    await build(1).onApplicationBootstrap();

    assert.equal(row(running.job.id).errorCode, 'job_interrupted');
    assert.equal(row(waiting.job.id).errorCode, 'job_interrupted');
  });

  it('TC33 — không cấu hình: mặc định 3 job chạy cùng lúc', LIMIT, async () => {
    service = build();
    for (const name of ['a', 'b', 'c', 'd']) await enqueue(name);

    await media.waitForStarted(3);
    await settle();
    assert.equal(media.peak, 3);
  });
});

describe('Cấu hình MEDIA_UPLOAD_JOB_CONCURRENCY', () => {
  const BASE = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };
  const saved = process.env.MEDIA_UPLOAD_JOB_CONCURRENCY;

  afterEach(() => {
    if (saved === undefined) delete process.env.MEDIA_UPLOAD_JOB_CONCURRENCY;
    else process.env.MEDIA_UPLOAD_JOB_CONCURRENCY = saved;
  });

  it('TC34 — media.config: mặc định 3, đọc được env', () => {
    delete process.env.MEDIA_UPLOAD_JOB_CONCURRENCY;
    assert.equal(mediaConfig().uploadJobConcurrency, 3);
    process.env.MEDIA_UPLOAD_JOB_CONCURRENCY = '5';
    assert.equal(mediaConfig().uploadJobConcurrency, 5);
  });

  it('TC34b — negative: env.validation từ chối 0 (hàng đợi sẽ không bao giờ chạy), số âm, số lẻ, chữ; nhận biên 1 và 50', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '51']) {
      assert.throws(() => validateEnvironment({ ...BASE, MEDIA_UPLOAD_JOB_CONCURRENCY: value }), /MEDIA_UPLOAD_JOB_CONCURRENCY/, value);
    }
    for (const value of ['1', '50']) {
      assert.equal(validateEnvironment({ ...BASE, MEDIA_UPLOAD_JOB_CONCURRENCY: value }).MEDIA_UPLOAD_JOB_CONCURRENCY, Number(value));
    }
    assert.equal(validateEnvironment(BASE).MEDIA_UPLOAD_JOB_CONCURRENCY, 3);
  });
});
