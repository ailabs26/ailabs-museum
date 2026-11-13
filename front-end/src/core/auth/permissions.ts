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
  ROOM_UPDATE: 'room:update',
  ROOM_DELETE: 'room:delete',
  EXHIBIT_READ: 'exhibit:read',
  EXHIBIT_CREATE: 'exhibit:create',
  EXHIBIT_UPDATE: 'exhibit:update',
  REVISION_SUBMIT: 'revision:submit',
  REVISION_PUBLISH: 'revision:publish',
  REVISION_REJECT: 'revision:reject',
  REVISION_HIDE: 'revision:hide',
  MEDIA_UPLOAD: 'media:upload',
  REPORT_READ: 'report:read',
  REPORT_RESOLVE: 'report:resolve',
  AUDIT_READ: 'audit:read',
  // Bản dịch đa ngôn ngữ (CMS i18n)
  TRANSLATION_READ: 'translation:read',
  TRANSLATION_MANAGE: 'translation:manage',
  // API Key đối tác
  APIKEY_READ: 'apikey:read',
  APIKEY_MANAGE: 'apikey:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
