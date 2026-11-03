import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { openSecret, sealSecret } from '../../../common/security/secret-box';
import { PasswordService } from '../../../common/security/password.service';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { UsersRepository } from '../../users/repositories/users.repository';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { TwoFactorRepository } from '../repositories/two-factor.repository';

export const TOTP_ISSUER = 'Aura Museum';
/** Bước TOTP chuẩn (RFC 6238) và độ lệch cho phép ±1 bước (±30 giây) do đồng hồ điện thoại. */
const STEP_SECONDS = 30;
const RECOVERY_CODE_COUNT = 10;

export interface TwoFactorSetup {
  /** URI `otpauth://` để app Authenticator nhận (QR mã hóa chính URI này). */
  otpauthUrl: string;
  /** Ảnh QR dạng data URL (PNG) — FE hiển thị trực tiếp. */
  qrDataUrl: string;
  /** Secret base32 để nhập tay khi không quét được QR. */
  secret: string;
}

export interface LoginCode {
  code?: string;
  recoveryCode?: string;
}

const invalidCode = (field: 'code' | 'recoveryCode' = 'code') => new BadRequestException({
  message: 'Mã xác thực không đúng hoặc đã hết hạn',
  errors: [{ code: 'invalid_2fa', field, message: 'Mã xác thực không đúng hoặc đã hết hạn' }],
});

/** Mã khôi phục: bỏ khoảng trắng/gạch, lowercase rồi băm — người dùng gõ "ABCDE-FGHIJ" hay "abcdefghij" đều được. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex');
}

/** 10 ký tự base32 (50 bit), hiển thị dạng `xxxxx-xxxxx`. */
function newRecoveryCode(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const chars = [...randomBytes(10)].map((byte) => alphabet[byte % 32]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/**
 * 2FA TOTP tùy chọn (RFC 6238 — Google Authenticator, Microsoft Authenticator, Authy…).
 * Secret mã hóa AES-256-GCM trong DB; mỗi mã chỉ dùng được một lần (`claimStep`); 10 mã khôi phục dùng một lần.
 */
@Injectable()
export class TwoFactorService {
  /** Ghi đè được trong test để giả lập thời gian. */
  now: () => number = Date.now;

  constructor(
    private readonly repo: TwoFactorRepository,
    private readonly users: UsersRepository,
    private readonly sessions: RefreshSessionsRepository,
    private readonly passwords: PasswordService,
    private readonly tx: TransactionManager,
    private readonly config: ConfigService,
  ) {}

  async status(userId: string): Promise<{ enabled: boolean; recoveryCodesRemaining: number }> {
    const state = await this.repo.getState(userId);
    const enabled = Boolean(state?.enabledAt);
    return { enabled, recoveryCodesRemaining: enabled ? await this.repo.countRemainingRecoveryCodes(userId) : 0 };
  }

  /** Bước 1: tạo secret mới (chờ xác nhận). Gọi lại thì thay secret chờ cũ. */
  async setup(user: AuthUser): Promise<TwoFactorSetup> {
    const state = await this.requireState(user.id);
    if (state.enabledAt) throw new ConflictException('Xác thực 2 lớp đang bật');
    const secret = authenticator.generateSecret(20);
    await this.repo.setPending(user.id, this.seal(secret));
    const otpauthUrl = authenticator.keyuri(user.email, TOTP_ISSUER, secret);
    return { otpauthUrl, qrDataUrl: await toDataURL(otpauthUrl, { margin: 1, width: 240 }), secret };
  }

  /** Bước 2: xác nhận bằng mã đầu tiên → bật 2FA, trả 10 mã khôi phục (chỉ hiện một lần), đăng xuất thiết bị khác. */
  async enable(user: AuthUser, code: string): Promise<{ recoveryCodes: string[] }> {
    const state = await this.requireState(user.id);
    if (state.enabledAt) throw new ConflictException('Xác thực 2 lớp đang bật');
    if (!state.pendingEnc) throw new BadRequestException('Chưa khởi tạo xác thực 2 lớp, hãy bắt đầu lại');
    const step = this.matchStep(this.open(state.pendingEnc), code);
    if (step === null) throw invalidCode();

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    await this.tx.run(async (manager) => {
      await this.repo.enable(user.id, state.pendingEnc!, step, recoveryCodes.map(hashRecoveryCode), manager);
      await this.sessions.revokeAllForUser(user.id, manager, user.sessionId);
    });
    return { recoveryCodes };
  }

  /** Tắt 2FA: cần mật khẩu hiện tại + mã TOTP hoặc mã khôi phục; đăng xuất thiết bị khác. */
  async disable(user: AuthUser, password: string, codes: LoginCode): Promise<void> {
    const state = await this.requireState(user.id);
    if (!state.enabledAt) throw new ConflictException('Xác thực 2 lớp chưa bật');
    const account = await this.users.findByIdWithAccess(user.id);
    if (!account || !(await this.passwords.compare(password, account.passwordHash))) {
      throw new WrongCurrentPasswordException();
    }
    if (!(await this.verifyLoginCode(user.id, codes))) throw invalidCode(codes.recoveryCode ? 'recoveryCode' : 'code');
    await this.tx.run(async (manager) => {
      await this.repo.disable(user.id, manager);
      await this.sessions.revokeAllForUser(user.id, manager, user.sessionId);
    });
  }

  /** Tạo bộ mã khôi phục mới (bộ cũ hết hiệu lực); cần mã TOTP hiện tại. */
  async regenerateRecoveryCodes(user: AuthUser, code: string): Promise<{ recoveryCodes: string[] }> {
    const state = await this.requireState(user.id);
    if (!state.enabledAt) throw new ConflictException('Xác thực 2 lớp chưa bật');
    if (!(await this.verifyLoginCode(user.id, { code }))) throw invalidCode();
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    await this.tx.run((manager) => this.repo.replaceRecoveryCodes(user.id, recoveryCodes.map(hashRecoveryCode), manager));
    return { recoveryCodes };
  }

  /** Admin tắt 2FA hộ người mất điện thoại: xóa secret + mã khôi phục, đăng xuất mọi thiết bị của người đó. */
  async adminReset(userId: string): Promise<{ id: string }> {
    const state = await this.repo.getState(userId);
    if (!state) throw new NotFoundException('Không tìm thấy tài khoản');
    if (!state.enabledAt) throw new ConflictException('Tài khoản này chưa bật xác thực 2 lớp');
    await this.tx.run(async (manager) => {
      await this.repo.disable(userId, manager);
      await this.sessions.revokeAllForUser(userId, manager);
    });
    return { id: userId };
  }

  /**
   * Kiểm mã khi đăng nhập (hoặc thao tác nhạy cảm): TOTP — mỗi bước chỉ dùng một lần; hoặc mã khôi phục — dùng một
   * lần. Trả false nếu sai/đã dùng; không ném lỗi.
   */
  async verifyLoginCode(userId: string, { code, recoveryCode }: LoginCode): Promise<boolean> {
    const state = await this.repo.getState(userId);
    if (!state?.enabledAt || !state.secretEnc) return false;
    if (recoveryCode) return this.repo.consumeRecoveryCode(userId, hashRecoveryCode(recoveryCode));
    if (!code) return false;
    const step = this.matchStep(this.open(state.secretEnc), code);
    return step !== null && this.repo.claimStep(userId, step);
  }

  /** Bước thời gian khớp với mã (cho lệch ±1 bước); null nếu sai. */
  private matchStep(secret: string, code: string): number | null {
    const token = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) return null;
    const epoch = this.now();
    const delta = authenticator.clone({ window: 1, epoch }).checkDelta(token, secret);
    return delta === null ? null : Math.floor(epoch / 1000 / STEP_SECONDS) + delta;
  }

  private async requireState(userId: string) {
    const state = await this.repo.getState(userId);
    if (!state) throw new NotFoundException('Không tìm thấy tài khoản');
    return state;
  }

  private seal(secret: string): string {
    return sealSecret(secret, this.config.getOrThrow<string>('jwt.totpEncryptionKey'));
  }

  private open(sealed: string): string {
    return openSecret(sealed, this.config.getOrThrow<string>('jwt.totpEncryptionKey'));
  }
}
