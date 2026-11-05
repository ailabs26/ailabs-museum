import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { dataSource as appDataSource } from '../../../config/data-source';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { AuditService } from '../../audit/services/audit.service';
import { User } from '../../users/entities/user.entity';
import { Media } from '../entities/media.entity';
import { MediaUploadJob, UPLOAD_JOB_ACTOR_KEY_CONSTRAINT, UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaUploadJobRepository, UploadJobPatch } from '../repositories/media-upload-job.repository';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaStorageService } from '../services/media-storage.service';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { MediaService } from '../services/media.service';
import { LocalStorageDriver } from '../storage/local-storage.driver';
import { FakeAuditRepository, testMediaUrlService, testUploadJobConfig } from './media-test-doubles';
import { buildGlb } from './media-test-files';

/** Repository thật, chỉ cài thêm lỗi vào đúng bước test cần. */
class FlakyJobRepository extends MediaUploadJobRepository {
  failSucceeded = false;
  failAfterLink = false;
  beforeLink?: (id: string) => Promise<void>;

  override async patch(id: string, data: UploadJobPatch): Promise<void> {
    if (this.failSucceeded && data.status === UploadJobStatus.SUCCEEDED) throw new Error('connection terminated unexpectedly');
    await super.patch(id, data);
  }

  override async linkMedia(id: string, mediaId: string, manager: EntityManager): Promise<void> {
    await this.beforeLink?.(id);
    await super.linkMedia(id, mediaId, manager);
    if (this.failAfterLink) throw new Error('connection terminated unexpectedly');
  }
}

/**
 * Invariant VT-078 trên PostgreSQL THẬT: N request đồng thời cùng (người tạo, key) chỉ tạo
 * một job. Chỉ chạy khi MEDIA_TEST_DATABASE_URL trỏ tới database cục bộ (localhost).
 */
const TEST_DATABASE_URL = process.env.MEDIA_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần MEDIA_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

describe('MediaUploadJobRepository (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let repo: FlakyJobRepository;
  let mediaService: MediaService;
  let auditRepo: FakeAuditRepository;
  let workDir: string;
  const tag = `itest-${randomUUID().slice(0, 8)}`;
  const userIds: string[] = [];

  async function createUser(): Promise<string> {
    const user = await db.getRepository(User).save({
      email: `${tag}-${userIds.length}@example.test`,
      passwordHash: 'not-a-real-hash',
      displayName: 'Upload job test',
    });
    userIds.push(user.id);
    return user.id;
  }

  before(async () => {
    // Pool đủ rộng để 20 insert thật sự chạy song song trên nhiều connection.
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL, extra: { max: 25 } } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    repo = new FlakyJobRepository(db.getRepository(MediaUploadJob));
    workDir = await mkdtemp(join(tmpdir(), 'upload-jobs-pg-'));
    mediaService = new MediaService(
      new MediaRepository(db.getRepository(Media)),
      new MediaStorageService(new LocalStorageDriver({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'quarantine') })),
      new MediaInspectionService(),
      new TransactionManager(db),
      testMediaUrlService(),
    );
  });

  /** Mỗi lần gọi là một "tiến trình" mới trên cùng database. */
  function startService(): MediaUploadJobService {
    auditRepo ??= new FakeAuditRepository();
    const service = new MediaUploadJobService(
      repo,
      mediaService,
      new AuditService(auditRepo as unknown as AuditRepository),
      testUploadJobConfig(),
    );
    service.completionRetryDelayMs = 0;
    return service;
  }

  const glb = () => ({ buffer: buildGlb(), originalname: 'tuong-phat.glb' });

  const mediaOf = (actor: string): Promise<Media[]> => db.getRepository(Media).find({ where: { createdById: actor } });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
    if (!db?.isInitialized) return;
    if (userIds.length) {
      await db.query('DELETE FROM media_upload_jobs WHERE created_by = ANY($1)', [userIds]);
      await db.query('DELETE FROM media WHERE created_by = ANY($1)', [userIds]);
      await db.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
    await db.destroy();
  });

  it('20 insert đồng thời cùng key → đúng 1 created, cả 20 nhận cùng job, bảng có 1 dòng', async () => {
    const actor = await createUser();
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        repo.insertOrFindExisting({ createdById: actor, idempotencyKey: key, requestChecksum: 'a'.repeat(64) }),
      ),
    );
    assert.equal(results.filter((r) => r.created).length, 1);
    assert.equal(new Set(results.map((r) => r.job.id)).size, 1);
    const [{ count }] = await db.query(
      'SELECT COUNT(*)::int AS count FROM media_upload_jobs WHERE created_by = $1 AND idempotency_key = $2',
      [actor, key],
    );
    assert.equal(count, 1);
  });

  it('unique constraint tồn tại đúng tên; created_by NOT NULL', async () => {
    const actor = await createUser();
    const row = { createdById: actor, idempotencyKey: 'dup', requestChecksum: 'b'.repeat(64) };
    // Bản sao mỗi lần: insert() gắn id vừa sinh vào object, dùng lại sẽ vi phạm PK thay vì UQ.
    await db.getRepository(MediaUploadJob).insert({ ...row });
    await assert.rejects(db.getRepository(MediaUploadJob).insert({ ...row }), (error: unknown) => {
      assert.ok(error instanceof QueryFailedError);
      const driver = error.driverError as { code?: string; constraint?: string };
      assert.equal(driver.code, '23505');
      assert.equal(driver.constraint, UPLOAD_JOB_ACTOR_KEY_CONSTRAINT);
      return true;
    });
    await assert.rejects(
      db.query('INSERT INTO media_upload_jobs (idempotency_key, request_checksum) VALUES ($1, $2)', ['no-actor', 'c'.repeat(64)]),
      /null value in column "created_by"/,
    );
  });

  it('findOwned chỉ trả job của đúng người tạo; failInterrupted chỉ đổi job dang dở', async () => {
    const actor = await createUser();
    const other = await createUser();
    const { job: running } = await repo.insertOrFindExisting({ createdById: actor, idempotencyKey: 'run', requestChecksum: 'd'.repeat(64) });
    const { job: done } = await repo.insertOrFindExisting({ createdById: actor, idempotencyKey: 'done', requestChecksum: 'e'.repeat(64) });
    await repo.patch(running.id, { status: UploadJobStatus.PROCESSING, progress: 50 });
    await repo.patch(done.id, { status: UploadJobStatus.SUCCEEDED, progress: 100 });

    assert.equal((await repo.findOwned(running.id, actor))?.id, running.id);
    assert.equal(await repo.findOwned(running.id, other), null);

    assert.ok((await repo.failInterrupted()) >= 1);
    const reloaded = await repo.findOwned(running.id, actor);
    assert.equal(reloaded?.status, UploadJobStatus.FAILED);
    assert.equal(reloaded?.errorCode, 'job_interrupted');
    assert.equal((await repo.findOwned(done.id, actor))?.status, UploadJobStatus.SUCCEEDED);
  });

  it('TC35-DB — deleteFinishedBefore chỉ xóa job succeeded/failed cũ hơn mốc; job dang dở và job mới giữ nguyên', async () => {
    const actor = await createUser();
    const insert = async (key: string, status: UploadJobStatus, daysOld: number) => {
      const { job } = await repo.insertOrFindExisting({ createdById: actor, idempotencyKey: key, requestChecksum: 'f'.repeat(64) });
      await db.query(`UPDATE media_upload_jobs SET status = $2, updated_at = now() - make_interval(days => $3) WHERE id = $1`, [job.id, status, daysOld]);
      return job.id;
    };
    const oldSucceeded = await insert('old-ok', UploadJobStatus.SUCCEEDED, 10);
    const oldFailed = await insert('old-fail', UploadJobStatus.FAILED, 10);
    const recent = await insert('recent', UploadJobStatus.SUCCEEDED, 1);
    const oldQueued = await insert('old-queued', UploadJobStatus.QUEUED, 10);
    const oldProcessing = await insert('old-processing', UploadJobStatus.PROCESSING, 10);

    const removed = await repo.deleteFinishedBefore(new Date(Date.now() - 7 * 86_400_000));

    assert.ok(removed >= 2);
    assert.equal(await repo.findOwned(oldSucceeded, actor), null);
    assert.equal(await repo.findOwned(oldFailed, actor), null);
    for (const kept of [recent, oldQueued, oldProcessing]) assert.ok(await repo.findOwned(kept, actor), `phải giữ ${kept}`);
  });

  it('TC35b-DB — failInterrupted đặt lại updated_at nên job vừa bị gián đoạn không bị dọn ngay trong cùng lần khởi động', async () => {
    const actor = await createUser();
    const { job } = await repo.insertOrFindExisting({ createdById: actor, idempotencyKey: 'stale', requestChecksum: 'f'.repeat(64) });
    await db.query(`UPDATE media_upload_jobs SET updated_at = now() - interval '30 days' WHERE id = $1`, [job.id]);

    await repo.failInterrupted();
    await repo.deleteFinishedBefore(new Date(Date.now() - 7 * 86_400_000));

    assert.equal((await repo.findOwned(job.id, actor))?.errorCode, 'job_interrupted');
  });

  it('TC38-DB — review P2: media lưu xong → 3 lần ghi succeeded lỗi → restart → retry cùng key: job succeeded có mediaId, không có media thứ hai', async () => {
    const actor = await createUser();
    const key = randomUUID();
    repo.failSucceeded = true;
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, actor, key);
    await worker.whenIdle();
    repo.failSucceeded = false;

    const [media, ...others] = await mediaOf(actor);
    assert.ok(media, 'media đã lưu');
    assert.equal(others.length, 0);
    const stuck = await repo.findOwned(job.id, actor);
    assert.equal(stuck?.status, UploadJobStatus.PROCESSING);
    assert.equal(stuck?.mediaId, media.id, 'liên kết phải nằm trong database, không chỉ trong log');

    const restarted = startService();
    await restarted.onApplicationBootstrap();

    const recovered = await repo.findOwned(job.id, actor);
    assert.equal(recovered?.status, UploadJobStatus.SUCCEEDED);
    assert.equal(recovered?.mediaId, media.id);
    assert.equal(recovered?.progress, 100);
    assert.equal(recovered?.errorCode, null);

    const retry = await restarted.enqueue(glb(), {}, actor, key);
    await restarted.whenIdle();
    assert.equal(retry.created, false);
    assert.equal(retry.job.id, job.id);
    assert.equal(retry.job.status, UploadJobStatus.SUCCEEDED);
    assert.equal(retry.job.mediaId, media.id);
    assert.equal((await mediaOf(actor)).length, 1, 'retry không tạo media thứ hai');
  });

  it('TC39-DB — khởi động: job có media → succeeded; job processing và queued chưa có media → failed job_interrupted', async () => {
    const actor = await createUser();
    repo.failSucceeded = true;
    const worker = startService();
    const { job: linked } = await worker.enqueue(glb(), {}, actor, randomUUID());
    await worker.whenIdle();
    repo.failSucceeded = false;
    const { job: running } = await repo.insertOrFindExisting({ createdById: actor, idempotencyKey: 'no-media', requestChecksum: 'd'.repeat(64) });
    await repo.patch(running.id, { status: UploadJobStatus.PROCESSING, progress: 50 });
    const { job: waiting } = await repo.insertOrFindExisting({ createdById: actor, idempotencyKey: 'waiting', requestChecksum: 'd'.repeat(64) });

    await startService().onApplicationBootstrap();

    assert.equal((await repo.findOwned(linked.id, actor))?.status, UploadJobStatus.SUCCEEDED);
    for (const id of [running.id, waiting.id]) {
      const row = await repo.findOwned(id, actor);
      assert.equal(row?.status, UploadJobStatus.FAILED);
      assert.equal(row?.errorCode, 'job_interrupted');
    }
  });

  it('TC41-DB — nguyên tử: ghi liên kết lỗi → rollback, không còn media mồ côi, job failed không có mediaId', async () => {
    const actor = await createUser();
    repo.failAfterLink = true;
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, actor, randomUUID());
    await worker.whenIdle();
    repo.failAfterLink = false;

    assert.deepEqual(await mediaOf(actor), []);
    const row = await repo.findOwned(job.id, actor);
    assert.equal(row?.status, UploadJobStatus.FAILED);
    assert.equal(row?.mediaId, null);
  });

  it('TC43-DB — job không còn processing lúc liên kết (instance khác đã ghi failed) → rollback media, job vẫn failed', async () => {
    const actor = await createUser();
    repo.beforeLink = (id) => repo.patch(id, { status: UploadJobStatus.FAILED, progress: 100, errorCode: 'job_interrupted' });
    const worker = startService();
    const { job } = await worker.enqueue(glb(), {}, actor, randomUUID());
    await worker.whenIdle();
    repo.beforeLink = undefined;

    assert.deepEqual(await mediaOf(actor), []);
    const row = await repo.findOwned(job.id, actor);
    assert.equal(row?.status, UploadJobStatus.FAILED);
    assert.equal(row?.mediaId, null);
  });
});
