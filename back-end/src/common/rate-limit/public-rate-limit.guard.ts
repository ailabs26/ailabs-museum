import { HttpException, HttpStatus, Injectable, Optional, SetMetadata } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { PublicRateLimiter, type PublicRateBucket } from './public-rate-limiter';

const PUBLIC_RATE_BUCKET_KEY = 'publicRateBucket';

/** Chọn nhóm giới hạn cho controller/route (mặc định `api`). Dùng kèm `@UseGuards(PublicRateLimitGuard)`. */
export const PublicRateBucketOf = (bucket: PublicRateBucket) => SetMetadata(PUBLIC_RATE_BUCKET_KEY, bucket);

/**
 * Giới hạn tần suất gọi API công khai theo IP (`req.ip`, phụ thuộc `TRUST_PROXY`). Vượt ngưỡng → 429
 * kèm `Retry-After`. Không có `PublicRateLimiter` trong DI (test dựng controller riêng) thì cho qua.
 */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly limiter?: PublicRateLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.limiter) return true;
    const bucket = this.reflector.getAllAndOverride<PublicRateBucket | undefined>(PUBLIC_RATE_BUCKET_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? 'api';
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const rate = this.limiter.consume(bucket, request.ip ?? 'unknown');

    response.setHeader('X-RateLimit-Limit', String(rate.limit));
    response.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    if (!rate.allowed) {
      response.setHeader('Retry-After', String(rate.retryAfter));
      throw new HttpException(
        { message: 'Quá nhiều yêu cầu, vui lòng thử lại sau', retryAfter: rate.retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
