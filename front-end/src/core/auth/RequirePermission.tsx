import type { ReactNode } from 'react';
import { useAuth } from './use-auth';

interface RequirePermissionProps {
  /** cần 1 trong các quyền này */
  anyOf?: string[];
  /** cần đủ tất cả quyền này */
  allOf?: string[];
  children: ReactNode;
  /** hiển thị khi thiếu quyền (mặc định: ẩn) */
  fallback?: ReactNode;
}

/**
 * Ẩn/hiện phần tử theo quyền (khớp @Permissions của BE).
 * Lưu ý: đây chỉ là UX — chốt chặn thật nằm ở guard backend.
 */
export function RequirePermission({
  anyOf,
  allOf,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { hasAnyPermission, hasPermission } = useAuth();
  const matchesAny = !anyOf?.length || hasAnyPermission(anyOf);
  const matchesAll = !allOf?.length || allOf.every(hasPermission);
  return <>{matchesAny && matchesAll ? children : fallback}</>;
}
