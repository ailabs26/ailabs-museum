import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { User } from '../../users/entities/user.entity';
import { UserRecoveryCode } from '../entities/user-recovery-code.entity';
import { TwoFactorRepository } from '../repositories/two-factor.repository';

/**
 * TwoFactorRepository trên PostgreSQL THẬT: cột bí mật không lộ qua truy vấn thường, chống dùng lại mã khi request
 * song song. Chỉ chạy khi CORE_TEST_DATABASE_URL trỏ localhost; chỉ đụng dữ liệu do test tạo.
 */
const TEST_DATABASE_URL = process.env.CORE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần CORE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

describe('TwoFactorRepository (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let repo: TwoFactorRepository;
  const created: string[] = [];

  async function createUser(): Promise<User> {
    const user = await db.getRepository(User).save({ email: `2fa-${randomUUID()}@example.test`, passwordHash: 'x', displayName: '2fa' });
    created.push(user.id);
    return user;
  }

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL, ssl: undefined } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    repo = new TwoFactorRepository(db.getRepository(User), db.getRepository(UserRecoveryCode));
  });

  after(async () => {
    if (!db?.isInitialized) return;
    if (created.length) await db.query('DELETE FROM users WHERE id = ANY($1)', [created]); // mã khôi phục CASCADE
    await db.destroy();
  });

  it('bật: secret chuyển từ chờ sang chính; cột bí mật KHÔNG có trong truy vấn thường (select: false)', async () => {
    const user = await createUser();
    await repo.setPending(user.id, 'v1.pending');
    await db.transaction((m) => repo.enable(user.id, 'v1.pending', 100, ['a'.repeat(64), 'b'.repeat(64)], m));

    const state = await repo.getState(user.id);
    assert.ok(state?.enabledAt);
    assert.deepEqual({ ...state, enabledAt: null }, { enabledAt: null, secretEnc: 'v1.pending', pendingEnc: null, lastStep: 100 });

    const plain = await db.getRepository(User).findOneByOrFail({ id: user.id });
    assert.ok(plain.totpEnabledAt);
    for (const key of ['totpSecretEnc', 'totpPendingEnc', 'totpLastStep'] as const) {
      assert.equal(plain[key], undefined, `${key} không được select mặc định`);
    }
    assert.equal(await repo.countRemainingRecoveryCodes(user.id), 2);
  });

  it('claimStep: bước mới hơn mới được; 5 request song song cùng một bước → đúng 1 thành công', async () => {
    const user = await createUser();
    await db.transaction((m) => repo.enable(user.id, 'v1.s', 100, [], m));
    assert.equal(await repo.claimStep(user.id, 100), false, 'bước đã dùng khi bật');
    assert.equal(await repo.claimStep(user.id, 99), false, 'bước cũ hơn');
    const results = await Promise.all(Array.from({ length: 5 }, () => repo.claimStep(user.id, 101)));
    assert.equal(results.filter(Boolean).length, 1);
  });

  it('mã khôi phục: dùng một lần, song song cũng chỉ 1 lần; tắt 2FA xóa hết mã và secret', async () => {
    const user = await createUser();
    const hash = 'c'.repeat(64);
    await db.transaction((m) => repo.enable(user.id, 'v1.s', 1, [hash, 'd'.repeat(64)], m));
    const results = await Promise.all(Array.from({ length: 4 }, () => repo.consumeRecoveryCode(user.id, hash)));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await repo.countRemainingRecoveryCodes(user.id), 1);

    await db.transaction((m) => repo.disable(user.id, m));
    assert.deepEqual(await repo.getState(user.id), { enabledAt: null, secretEnc: null, pendingEnc: null, lastStep: null });
    assert.equal(await repo.countRemainingRecoveryCodes(user.id), 0);
    assert.equal(await repo.claimStep(user.id, 999), false, 'đã tắt thì không nhận mã');
  });
});
