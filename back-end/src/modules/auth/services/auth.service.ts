import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuthUser } from '../../../common/types/auth-user.type';
import { UserStatus } from '../../users/entities/user.entity';
import { PasswordService } from '../../../common/security/password.service';
import { UsersRepository } from '../../users/repositories/users.repository';
import { toAuthUser } from '../../users/user-access.util';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { SessionClient, TokenService } from './token.service';

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
  /** raw refresh token để controller set vào httpOnly cookie. */
  refreshToken: string;
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
  ) {}

  async login(dto: LoginDto, client: SessionClient = {}): Promise<LoginResult> {
    const user = await this.users.findByEmailWithAccess(dto.email);
    // So khớp mật khẩu kể cả khi không tìm thấy user để tránh lộ user tồn tại qua thời gian phản hồi.
    const passwordOk = await this.passwords.compare(dto.password, user?.passwordHash);

    if (!user || !passwordOk) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

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
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
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

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findByIdWithAccess(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    return toAuthUser(user);
  }

  logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return Promise.resolve();
    }

    return this.tokens.revokeByRaw(rawToken);
  }
}
