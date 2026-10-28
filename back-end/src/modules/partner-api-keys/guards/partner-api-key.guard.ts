import {
  ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { hasScope, type ApiScope } from '../constants/scopes';
import { PARTNER_SCOPE_KEY } from '../decorators/partner-scopes.decorator';
import type { PartnerApiKey } from '../entities/partner-api-key.entity';
import { PartnerApiKeysService } from '../services/partner-api-keys.service';
import { PartnerRateLimiter } from '../services/partner-rate-limiter.service';

export type PartnerRequest = Request & { partner?: Pick<PartnerApiKey, 'id' | 'partnerName' | 'scopes'> };

/**
 * Cổng đối tác `/partner/v1`: xác thực header `X-API-Key` (401) → giới hạn request/phút của key (429)
 * → kiểm scope của route (403). Route đối tác là `@Public()` nên guard JWT của admin bỏ qua.
 */
@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly keys: PartnerApiKeysService,
    private readonly limiter: PartnerRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<PartnerRequest>();
    const response = http.getResponse<Response>();

    const plaintext = request.get('x-api-key')?.trim();
    const key = plaintext ? await this.keys.authenticate(plaintext) : null;
    if (!key) {
      throw new UnauthorizedException('API key không hợp lệ, đã bị thu hồi hoặc đã hết hạn');
    }

    const rate = this.limiter.consume(key.id, key.rateLimitPerMinute);
    response.setHeader('X-RateLimit-Limit', String(rate.limit));
    response.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    if (!rate.allowed) {
      response.setHeader('Retry-After', String(rate.retryAfter));
      throw new HttpException({ message: 'Vượt giới hạn request của API key', retryAfter: rate.retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const required = this.reflector.getAllAndOverride<ApiScope | undefined>(PARTNER_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !hasScope(key.scopes, required)) {
      throw new ForbiddenException(`API key thiếu phạm vi "${required}"`);
    }

    request.partner = { id: key.id, partnerName: key.partnerName, scopes: key.scopes };
    void this.keys.recordUse(key);
    return true;
  }
}
