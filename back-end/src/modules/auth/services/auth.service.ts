import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuthUser } from '../../../common/types/auth-user.type';
import { UserStatus } from '../../users/entities/user.entity';
import { PasswordService } from '../../../common/security/password.service';
import { UsersRepository } from '../../users/repositories/users.repository';
import { toAuthUser } from '../../users/user-access.util';
import { LoginDto } from '../dto/login.dto';
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
