import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { REQUEST_ID_HEADER } from '../../common/middleware/request-id.middleware';

/** Nguồn của request ghi kèm audit. IP lấy theo Express (`trust proxy` quyết định — issue #82). */
export interface AuditClientInfo {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

/** User-Agent đọc thẳng từ header (không phụ thuộc `request.get`), cắt độ dài cho cột DB. */
export function userAgentOf(request: Pick<Request, 'headers'>): string | null {
  const value = request.headers['user-agent'];
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 512) : null;
}

export function auditClientInfo(request: Request): AuditClientInfo {
  const header = request.headers[REQUEST_ID_HEADER];
  return {
    ip: request.ip?.slice(0, 64) ?? null,
    userAgent: userAgentOf(request),
    requestId: typeof header === 'string' && header.length > 0 ? header.slice(0, 100) : randomUUID(),
  };
}
