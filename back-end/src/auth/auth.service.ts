import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user.type';
import { UserStatus } from '../users/user.entity';
import { PasswordService } from '../core/security/password.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { toAuthUser } from '../users/user-access.util';
import { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';

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
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findByEmailWithAccess(dto.email);
    // So khớp mật khẩu kể cả khi không tìm thấy user để tránh lộ user tồn tại qua thời gian phản hồi.
    const passwordOk = user
      ? await this.passwords.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordOk) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const authUser = toAuthUser(user);
    const accessToken = await this.tokens.signAccess(authUser);
    const { raw } = await this.tokens.issueRefresh(user.id);
    return { accessToken, user: authUser, refreshToken: raw };
  }

  async refresh(rawToken: string | undefined): Promise<RefreshResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Thiếu refresh token');
    }

    const rotated = await this.tokens.rotate(rawToken);
    const user = await this.users.findByIdWithAccess(rotated.userId);
    if (!user || user.status === UserStatus.DISABLED) {
      await this.tokens.revokeSession(rotated.session.id);
      throw new UnauthorizedException('Tài khoản không khả dụng');
    }

    const accessToken = await this.tokens.signAccess(toAuthUser(user));
    return { accessToken, refreshToken: rotated.raw };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findByIdWithAccess(userId);
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    return toAuthUser(user);
  }

  logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return Promise.resolve();
    return this.tokens.revokeByRaw(rawToken);
  }
}
