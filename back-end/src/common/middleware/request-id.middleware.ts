import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Gắn mã định danh request (correlation id) cho mỗi request: nếu client đã gửi
 * header X-Request-Id thì giữ nguyên, nếu không thì sinh uuid. Ghi lại vào request
 * (để AuditInterceptor đọc) và trả ra response header để client/đội vận hành truy vết.
 * Tương ứng middleware correlation-id trong pipeline .NET tham khảo.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.slice(0, 100)
        : randomUUID();
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
