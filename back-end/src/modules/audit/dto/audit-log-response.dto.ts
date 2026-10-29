import type { AuditLog } from '../entities/audit-log.entity';

/** Bản ghi audit trả cho CMS: actor chỉ gồm id/email/tên — không bao giờ lộ passwordHash hay trạng thái tài khoản. */
export interface AuditLogResponse {
  id: string;
  actorId: string | null;
  actor: { id: string; email: string; displayName: string } | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  revisionId: string | null;
  reason: string | null;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  occurredAt: Date;
}

export function toAuditLogResponse(log: AuditLog): AuditLogResponse {
  return {
    id: log.id,
    actorId: log.actorId,
    actor: log.actor ? { id: log.actor.id, email: log.actor.email, displayName: log.actor.displayName } : null,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    revisionId: log.revisionId,
    reason: log.reason,
    requestId: log.requestId,
    ip: log.ip,
    userAgent: log.userAgent,
    occurredAt: log.occurredAt,
  };
}
