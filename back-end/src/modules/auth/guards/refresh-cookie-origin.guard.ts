import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** Kiểm tra Origin cho thao tác dùng refresh cookie mà không cần access JWT. */
@Injectable()
export class RefreshCookieOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('origin');

    // CLI/native clients không gửi Origin; browser vẫn chịu cookie SameSite=lax.
    if (!origin) {
      return true;
    }

    const frontendOrigin = new URL(
      this.config.getOrThrow<string>('app.frontendOrigin'),
    ).origin;
    const apiOrigin = `${request.protocol}://${request.get('host')}`;

    if (origin !== frontendOrigin && origin !== apiOrigin) {
      throw new ForbiddenException('Origin không được phép thực hiện xác thực');
    }

    return true;
  }
}
