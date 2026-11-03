/**
 * Payload của access token JWT. Mang sẵn roles + permissions để PermissionsGuard
 * không phải truy vấn DB mỗi request (xem docs/plans/admin-subsystem-plan.md §3).
 */
export interface JwtAccessPayload {
  /** userId (chuẩn JWT dùng `sub`). */
  sub: string;
  email: string;
  displayName: string;
  roles: string[];
  /** danh sách permission dạng 'resource:action'. */
  permissions: string[];
  /** familyId của refresh session phát hành token — ActiveSessionGuard kiểm phiên còn sống. */
  sid?: string;
}
