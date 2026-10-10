/**
 * Thông tin người dùng đã xác thực, gắn vào request bởi JwtAuthGuard (hoàn thiện ở PR #D).
 * PermissionsGuard và @CurrentUser() đọc từ đây.
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  /** danh sách permission dạng 'resource:action' đã gộp từ các role */
  permissions: string[];
}
