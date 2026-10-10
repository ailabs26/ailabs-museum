import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionKey } from '../../common/constants/permissions.constant';
import { AuthUser } from '../../common/types/auth-user.type';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';

/**
 * RBAC guard: đối chiếu @Permissions(...) của route với quyền của user.
 * Chạy SAU JwtAuthGuard (request.user đã được gắn). Route không khai báo quyền
 * hoặc @Public() thì bỏ qua.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new ForbiddenException('Chưa xác thực hoặc thiếu thông tin quyền');
    }

    const granted = new Set(user.permissions ?? []);
    const missing = required.filter((perm) => !granted.has(perm));
    if (missing.length > 0) {
      throw new ForbiddenException(`Thiếu quyền: ${missing.join(', ')}`);
    }
    return true;
  }
}
