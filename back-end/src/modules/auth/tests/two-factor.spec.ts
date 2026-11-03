import 'reflect-metadata';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import type { EntityManager } from 'typeorm';
import type { TransactionManager } from '../../../common/database/transaction.manager';
import type { PasswordService } from '../../../common/security/password.service';
import { openSecret, sealSecret } from '../../../common/security/secret-box';
import type { AuthUser } from '../../../common/types/auth-user.type';
import type { UsersRepository } from '../../users/repositories/users.repository';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import type { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import type { TwoFactorRepository, TwoFactorState } from '../repositories/two-factor.repository';
import { hashRecoveryCode, TwoFactorService } from '../services/two-factor.service';

const KEY = 'test-totp-encryption-key-0123456789';
const USER: AuthUser = { id: 'u1', email: 'lan@aura.local', displayName: 'Lan', roles: [], permissions: [], sessionId: 'fam-current' };
const T0 = Date.UTC(2026, 10, 3, 9, 0, 0); // ranh giới bước 30 giây
const codeAt = (secret: string, ms: number) => authenticator.clone({ epoch: ms }).generate(secret);

describe('secret-box (AES-256-GCM)', () => {
  it('mã hóa rồi giải mã lại đúng; mỗi lần mã hóa ra chuỗi khác (iv ngẫu nhiên)', () => {
    const a = sealSecret('JBSWY3DPEHPK3PXP', KEY);
    assert.notEqual(a, sealSecret('JBSWY3DPEHPK3PXP', KEY));
    assert.equal(openSecret(a, KEY), 'JBSWY3DPEHPK3PXP');
    assert.match(a, /^v1\./);
  });
  it('sai khóa, bị sửa hoặc sai định dạng → ném lỗi (không trả rác)', () => {
    const sealed = sealSecret('secret', KEY);
    assert.throws(() => openSecret(sealed, 'other-key-0123456789-0123456789'));
    const [v, iv, tag, data] = sealed.split('.');
    assert.throws(() => openSecret([v, iv, tag, `${data.slice(0, -2)}AA`].join('.'), KEY));
    assert.throws(() => openSecret('plain-secret', KEY));
  });
});

/** Repo 2FA trong bộ nhớ + đồng hồ giả. */
function harness() {
  const state: TwoFactorState = { enabledAt: null, secretEnc: null, pendingEnc: null, lastStep: null };
  const codes = new Map<string, boolean>(); // hash → đã dùng
  const revoked: { userId: string; except?: string }[] = [];
  const repo = {
    getState: async (id: string) => (id === USER.id || id === 'other' ? { ...state } : null),
    setPending: async (_id: string, enc: string) => { state.pendingEnc = enc; },
    enable: async (_id: string, secretEnc: string, step: number, hashes: string[]) => {
      Object.assign(state, { secretEnc, pendingEnc: null, enabledAt: new Date(), lastStep: step });
      codes.clear(); hashes.forEach((h) => codes.set(h, false));
    },
    disable: async () => { Object.assign(state, { secretEnc: null, pendingEnc: null, enabledAt: null, lastStep: null }); codes.clear(); },
    claimStep: async (_id: string, step: number) => {
      if (!state.enabledAt || (state.lastStep !== null && state.lastStep >= step)) return false;
      state.lastStep = step; return true;
    },
    consumeRecoveryCode: async (_id: string, hash: string) => {
      if (codes.get(hash) !== false) return false;
      codes.set(hash, true); return true;
    },
    replaceRecoveryCodes: async (_id: string, hashes: string[]) => { codes.clear(); hashes.forEach((h) => codes.set(h, false)); },
    countRemainingRecoveryCodes: async () => [...codes.values()].filter((used) => !used).length,
  } as unknown as TwoFactorRepository;
  const users = { findByIdWithAccess: async () => ({ id: USER.id, passwordHash: 'hash:right' }) } as unknown as UsersRepository;
  const sessions = {
    revokeAllForUser: async (userId: string, _m: EntityManager, except?: string) => { revoked.push({ userId, except }); },
  } as unknown as RefreshSessionsRepository;
  const passwords = { compare: async (plain: string, hash?: string) => hash === `hash:${plain}` } as unknown as PasswordService;
  const tx = { run: <T>(work: (m: EntityManager) => Promise<T>) => work({} as EntityManager) } as TransactionManager;
  const config = { getOrThrow: () => KEY } as unknown as ConfigService;
  const service = new TwoFactorService(repo, users, sessions, passwords, tx, config);
  let now = T0;
  service.now = () => now;
  return { service, state, codes, revoked, setNow: (ms: number) => { now = ms; } };
}

describe('TwoFactorService', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  /** Thiết lập + bật 2FA, trả secret và mã khôi phục. */
  async function enable() {
    const setup = await h.service.setup(USER);
    const { recoveryCodes } = await h.service.enable(USER, codeAt(setup.secret, T0));
    return { secret: setup.secret, recoveryCodes };
  }

  it('setup: secret base32 lưu dạng mã hóa (chờ xác nhận), URI otpauth đúng issuer/tài khoản, QR là data URL PNG', async () => {
    const setup = await h.service.setup(USER);
    assert.match(setup.secret, /^[A-Z2-7]{32}$/);
    assert.ok(setup.otpauthUrl.startsWith('otpauth://totp/Aura%20Museum:lan%40aura.local?secret='));
    assert.ok(setup.otpauthUrl.includes('issuer=Aura%20Museum'));
    assert.ok(setup.qrDataUrl.startsWith('data:image/png;base64,'));
    assert.ok(h.state.pendingEnc && !h.state.pendingEnc.includes(setup.secret), 'secret không lưu dạng rõ');
    assert.equal(h.state.enabledAt, null, 'chưa bật tới khi xác nhận');
  });

  it('enable: mã đúng → bật, 10 mã khôi phục dạng xxxxx-xxxxx khác nhau, đăng xuất thiết bị khác (giữ thiết bị này)', async () => {
    const { recoveryCodes } = await enable();
    assert.ok(h.state.enabledAt);
    assert.equal(recoveryCodes.length, 10);
    assert.equal(new Set(recoveryCodes).size, 10);
    for (const code of recoveryCodes) assert.match(code, /^[a-z2-7]{5}-[a-z2-7]{5}$/);
    assert.deepEqual(h.revoked, [{ userId: USER.id, except: 'fam-current' }]);
    assert.deepEqual(await h.service.status(USER.id), { enabled: true, recoveryCodesRemaining: 10 });
  });

  it('enable: mã sai / chưa setup / đã bật → lỗi phù hợp', async () => {
    await assert.rejects(h.service.enable(USER, '123456'), BadRequestException); // chưa setup
    await h.service.setup(USER);
    await assert.rejects(h.service.enable(USER, '000000'), BadRequestException);
    await assert.rejects(h.service.enable(USER, 'abcdef'), BadRequestException);
    h.state.enabledAt = new Date();
    await assert.rejects(h.service.setup(USER), ConflictException);
  });

  it('đăng nhập: mã đúng được; lệch ±30 giây vẫn được; lệch 90 giây thì không', async () => {
    const { secret } = await enable();
    h.setNow(T0 + 60_000);
    assert.equal(await h.service.verifyLoginCode(USER.id, { code: codeAt(secret, T0 + 60_000) }), true);
    h.setNow(T0 + 120_000);
    assert.equal(await h.service.verifyLoginCode(USER.id, { code: codeAt(secret, T0 + 150_000) }), true, 'điện thoại nhanh 30 giây');
    h.setNow(T0 + 300_000);
    assert.equal(await h.service.verifyLoginCode(USER.id, { code: codeAt(secret, T0 + 210_000) }), false, 'lệch 90 giây');
  });

  it('chống dùng lại: cùng một mã (cùng bước) chỉ dùng được một lần, kể cả mã dùng lúc bật', async () => {
    const { secret } = await enable();
    assert.equal(await h.service.verifyLoginCode(USER.id, { code: codeAt(secret, T0) }), false, 'mã đã dùng khi bật');
    h.setNow(T0 + 30_000);
    const code = codeAt(secret, T0 + 30_000);
    assert.equal(await h.service.verifyLoginCode(USER.id, { code }), true);
    assert.equal(await h.service.verifyLoginCode(USER.id, { code }), false);
  });

  it('mã khôi phục: dùng một lần, không phân biệt hoa thường/gạch/khoảng trắng; mã lạ → false', async () => {
    const { recoveryCodes } = await enable();
    const typed = ` ${recoveryCodes[3].toUpperCase().replace('-', ' ')} `;
    assert.equal(await h.service.verifyLoginCode(USER.id, { recoveryCode: typed }), true);
    assert.equal(await h.service.verifyLoginCode(USER.id, { recoveryCode: recoveryCodes[3] }), false);
    assert.equal(await h.service.verifyLoginCode(USER.id, { recoveryCode: 'aaaaa-bbbbb' }), false);
    assert.equal((await h.service.status(USER.id)).recoveryCodesRemaining, 9);
    assert.equal(hashRecoveryCode('ABCDE-FGHIJ'), hashRecoveryCode('abcdefghij'));
  });

  it('chưa bật 2FA → verifyLoginCode luôn false', async () => {
    assert.equal(await h.service.verifyLoginCode(USER.id, { code: '123456' }), false);
  });

  it('disable: sai mật khẩu → WrongCurrentPassword; sai mã → 400; đúng → tắt + xóa mã + đăng xuất thiết bị khác', async () => {
    const { secret } = await enable();
    h.revoked.length = 0;
    h.setNow(T0 + 30_000);
    await assert.rejects(h.service.disable(USER, 'wrong', { code: codeAt(secret, T0 + 30_000) }), WrongCurrentPasswordException);
    await assert.rejects(h.service.disable(USER, 'right', { code: '000000' }), BadRequestException);
    await h.service.disable(USER, 'right', { code: codeAt(secret, T0 + 30_000) });
    assert.equal(h.state.enabledAt, null);
    assert.equal(h.state.secretEnc, null);
    assert.equal(h.codes.size, 0);
    assert.deepEqual(h.revoked, [{ userId: USER.id, except: 'fam-current' }]);
  });

  it('tạo lại mã khôi phục: bộ cũ hết hiệu lực; cần mã TOTP đúng', async () => {
    const { secret, recoveryCodes: oldCodes } = await enable();
    await assert.rejects(h.service.regenerateRecoveryCodes(USER, '000000'), BadRequestException);
    h.setNow(T0 + 30_000);
    const { recoveryCodes } = await h.service.regenerateRecoveryCodes(USER, codeAt(secret, T0 + 30_000));
    assert.equal(recoveryCodes.length, 10);
    assert.equal(await h.service.verifyLoginCode(USER.id, { recoveryCode: oldCodes[0] }), false);
    assert.equal(await h.service.verifyLoginCode(USER.id, { recoveryCode: recoveryCodes[0] }), true);
  });

  it('Admin tắt hộ: chưa bật → 409; đã bật → tắt và đăng xuất MỌI thiết bị của người đó', async () => {
    await assert.rejects(h.service.adminReset(USER.id), ConflictException);
    await enable();
    h.revoked.length = 0;
    assert.deepEqual(await h.service.adminReset(USER.id), { id: USER.id });
    assert.equal(h.state.enabledAt, null);
    assert.deepEqual(h.revoked, [{ userId: USER.id, except: undefined }]);
  });
});
