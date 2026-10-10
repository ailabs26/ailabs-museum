import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit_action';

export interface AuditMeta {
  /** vd: 'user.create', 'role.update' */
  action: string;
  /** vd: 'user', 'role' */
  resourceType: string;
}

/**
 * Đánh dấu route cần ghi vết. AuditInterceptor sẽ tạo AuditLog sau khi route
 * chạy thành công.
 * @example @Audit('user.create', 'user')
 */
export const Audit = (action: string, resourceType: string) =>
  SetMetadata(AUDIT_KEY, { action, resourceType } satisfies AuditMeta);
