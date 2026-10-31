import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DataSource, QueryFailedError } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { User } from '../../users/entities/user.entity';
import { MediaUploadJob, UPLOAD_JOB_ACTOR_KEY_CONSTRAINT, UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';

/**
 * Invariant VT-078 trên PostgreSQL THẬT: N request đồng thời cùng (người tạo, key) chỉ tạo
 * một job. Chỉ chạy khi MEDIA_TEST_DATABASE_URL trỏ tới database cục bộ (localhost).
 */
const TEST_DATABASE_URL = process.env.MEDIA_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần MEDIA_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

describe('MediaUploadJobRepository (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let repo: MediaUploadJobRepository;
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
    repo = new MediaUploadJobRepository(db.getRepository(MediaUploadJob));
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (userIds.length) {
      await db.query('DELETE FROM media_upload_jobs WHERE created_by = ANY($1)', [userIds]);
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
});
