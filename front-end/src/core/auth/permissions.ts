/**
 * Danh mục permission phía FE — mirror của BE common/constants/permissions.constant.ts.
 * Dùng cho RequirePermission và điều hướng. BE mới là chốt chặn thật.
 */
export const PERMISSIONS = {
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  ROLE_READ: 'role:read',
  ROLE_UPDATE: 'role:update',
  ROLE_ASSIGN: 'role:assign',
  PERMISSION_READ: 'permission:read',
  ROOM_READ: 'room:read',
  ROOM_CREATE: 'room:create',
  EXHIBIT_READ: 'exhibit:read',
  EXHIBIT_CREATE: 'exhibit:create',
  REVISION_PUBLISH: 'revision:publish',
  MEDIA_UPLOAD: 'media:upload',
  REPORT_READ: 'report:read',
  AUDIT_READ: 'audit:read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
