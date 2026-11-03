import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';

/**
 * Chạy sau JwtAuthGuard: access token chỉ hợp lệ khi phiên (refresh family) phát hành nó còn sống.
 * Nhờ đó đăng xuất thiết bị, đổi mật khẩu, khóa/xóa user có hiệu lực ngay thay vì đợi hết TTL.
 * Token không có `sid` (phát hành trước khi có guard) → 401, frontend tự refresh lấy token mới.
 */
@Injectable()
export class ActiveSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: RefreshSessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user?.sessionId || !(await this.sessions.isFamilyLive(user.sessionId))) {
      throw new UnauthorizedException('Phiên đăng nhập đã kết thúc');
    }
    return true;
  }
}
