import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuthUser } from '../../../common/types/auth-user.type';
import { User, UserStatus } from '../../users/entities/user.entity';
import { PasswordService } from '../../../common/security/password.service';
import { UsersRepository } from '../../users/repositories/users.repository';
import { toAuthUser } from '../../users/user-access.util';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { LoginFailedException } from '../exceptions/login-failed.exception';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { AuthRateLimiter } from './auth-rate-limiter.service';
import { passwordFingerprint, SessionClient, TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
  /** raw refresh token để controller set vào httpOnly cookie. */
  refreshToken: string;
}

/** Đúng mật khẩu nhưng tài khoản bật 2FA: chưa cấp phiên, chờ `POST /auth/login/2fa`. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export interface LoginTwoFactorInput {
  mfaToken: string;
  code?: string;
  recoveryCode?: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly tx: TransactionManager,
    private readonly sessions: RefreshSessionsRepository,
    private readonly twoFactor: TwoFactorService,
    private readonly limiter: AuthRateLimiter,
  ) {}

  async login(dto: LoginDto, client: SessionClient = {}): Promise<LoginResult | MfaChallenge> {
    const user = await this.users.findByEmailWithAccess(dto.email);
    // So khớp mật khẩu kể cả khi không tìm thấy user để tránh lộ user tồn tại qua thời gian phản hồi.
    const passwordOk = await this.passwords.compare(dto.password, user?.passwordHash);

    if (!user) {
      throw new LoginFailedException('unknown_account', null);
    }
    if (!passwordOk) {
      throw new LoginFailedException('invalid_password', user.id);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new LoginFailedException('account_disabled', user.id, 'Tài khoản đã bị khóa');
    }

    if (user.totpEnabledAt) {
      return { mfaRequired: true, mfaToken: await this.tokens.signMfaChallenge(user.id, user.passwordHash) };
    }
    return this.issueSession(user, client);
  }

  /**
   * Bước 2 đăng nhập: kiểm token tạm + mã TOTP (hoặc mã khôi phục) rồi mới cấp phiên. Sai quá 5 lần / 15 phút / tài
   * khoản → 429. Token hết hạn, sai, hoặc mật khẩu đã đổi giữa chừng → phải đăng nhập lại từ đầu.
   */
  async loginTwoFactor(dto: LoginTwoFactorInput, client: SessionClient = {}): Promise<LoginResult> {
    const claims = await this.tokens.verifyMfaChallenge(dto.mfaToken);
    const expired = () => new LoginFailedException('mfa_expired', claims?.userId ?? null,
      'Phiên xác thực đã hết hạn, vui lòng đăng nhập lại');
    if (!claims) throw expired();
    const user = await this.users.findByIdWithAccess(claims.userId);
    if (!user || passwordFingerprint(user.passwordHash) !== claims.pwd) throw expired();
    if (user.status !== UserStatus.ACTIVE) {
      throw new LoginFailedException('account_disabled', user.id, 'Tài khoản đã bị khóa');
    }

    this.limiter.assertMfaAllowed(user.id);
    if (!(await this.twoFactor.verifyLoginCode(user.id, { code: dto.code, recoveryCode: dto.recoveryCode }))) {
      this.limiter.recordMfaFailure(user.id);
      throw new LoginFailedException('invalid_2fa', user.id, 'Mã xác thực không đúng hoặc đã hết hạn');
    }
    this.limiter.resetMfa(user.id);
    return this.issueSession(user, client);
  }

  /** Cấp phiên sau khi đã xác thực đủ (mật khẩu, và 2FA nếu bật). */
  private async issueSession(user: User, client: SessionClient): Promise<LoginResult> {
    // Phát hành phiên dưới khóa user và đọc lại: nếu Admin vừa đổi mật khẩu/khóa trong lúc so bcrypt
    // thì không cấp phiên bằng mật khẩu cũ (revokeAllForUser giữ khóa độc quyền cùng key).
    const issued = await this.tx.run(async (manager) => {
      await this.sessions.lockUser(user.id, manager);
      const fresh = await this.users.findByIdWithAccess(user.id, manager);
      if (!fresh || fresh.status !== UserStatus.ACTIVE || fresh.passwordHash !== user.passwordHash) {
        return null;
      }
      return this.tokens.issueRefresh(user.id, undefined, manager, client);
    });
    if (!issued) {
      throw new LoginFailedException('credentials_changed', user.id);
    }

    const authUser = toAuthUser(user);
    const accessToken = await this.tokens.signAccess(authUser, issued.session.familyId);
    return { accessToken, user: authUser, refreshToken: issued.raw };
  }

  async refresh(rawToken: string | undefined, client: SessionClient = {}): Promise<RefreshResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Thiếu refresh token');
    }

    const rotated = await this.tokens.rotate(rawToken, client);
    return { accessToken: rotated.accessToken, refreshToken: rotated.raw };
  }

  /**
   * Người dùng tự đổi mật khẩu: kiểm mật khẩu hiện tại, ghi hash mới và đăng xuất mọi thiết bị
   * khác (giữ thiết bị đang dùng) trong cùng transaction.
   */
  async changePassword(actor: AuthUser, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findByIdWithAccess(actor.id);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    if (!(await this.passwords.compare(dto.currentPassword, user.passwordHash))) {
      throw new WrongCurrentPasswordException();
    }
    if (await this.passwords.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException({
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
        errors: [{ code: 'same_password', field: 'newPassword', message: 'Mật khẩu mới phải khác mật khẩu hiện tại' }],
      });
    }

    const newHash = await this.passwords.hash(dto.newPassword);
    await this.tx.run(async (manager) => {
      // Khóa độc quyền theo user (cùng key với refresh/login) rồi đọc lại: nếu Admin vừa đặt lại
      // mật khẩu hoặc khóa tài khoản trong lúc so bcrypt thì không ghi đè.
      await this.sessions.lockUser(user.id, manager, true);
      const fresh = await this.users.findByIdWithAccess(user.id, manager);
      if (!fresh || fresh.status !== UserStatus.ACTIVE || fresh.passwordHash !== user.passwordHash) {
        throw new ConflictException('Mật khẩu vừa được thay đổi ở nơi khác, vui lòng thử lại');
      }
      await this.users.update(user.id, { passwordHash: newHash }, manager);
      await this.sessions.revokeAllForUser(user.id, manager, actor.sessionId);
    });
  }

  /** Người dùng tự đổi tên hiển thị; trả AuthUser mới để giao diện cập nhật ngay. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUser> {
    const current = await this.me(userId);
    await this.users.update(current.id, { displayName: dto.displayName });
    return this.me(userId);
  }

  async me(userId: string): Promise<AuthUser & { twoFactorEnabled: boolean }> {
    const user = await this.users.findByIdWithAccess(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    return { ...toAuthUser(user), twoFactorEnabled: Boolean(user.totpEnabledAt) };
  }

  /** Thu hồi phiên của cookie; trả userId của phiên (null nếu không có cookie/phiên) để ghi audit. */
  logout(rawToken: string | undefined): Promise<string | null> {
    if (!rawToken) {
      return Promise.resolve(null);
    }

    return this.tokens.revokeByRaw(rawToken);
  }
}
