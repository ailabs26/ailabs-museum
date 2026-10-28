import { RoleKey } from '../enums/role.enum';

/**
 * Danh mục permission dạng 'resource:action' (xem 05-security-rbac.md).
 * Dùng chung cho @Permissions() ở controller và seed role (PR #C).
 */
export const PERMISSIONS = {
  // người dùng & phân quyền
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',
  PERMISSION_READ: 'permission:read',
  // nội dung
  ROOM_READ: 'room:read',
  ROOM_CREATE: 'room:create',
  ROOM_UPDATE: 'room:update',
  ROOM_DELETE: 'room:delete',
  EXHIBIT_READ: 'exhibit:read',
  EXHIBIT_CREATE: 'exhibit:create',
  EXHIBIT_UPDATE: 'exhibit:update',
  REVISION_CREATE: 'revision:create',
  REVISION_SUBMIT: 'revision:submit',
  REVISION_PUBLISH: 'revision:publish',
  REVISION_REJECT: 'revision:reject',
  REVISION_HIDE: 'revision:hide',
  MEDIA_UPLOAD: 'media:upload',
  MEDIA_ATTACH: 'media:attach',
  // kiểm duyệt & báo cáo
  REPORT_READ: 'report:read',
  REPORT_RESOLVE: 'report:resolve',
  // hệ thống
  AUDIT_READ: 'audit:read',
  // bản dịch đa ngôn ngữ (CMS i18n)
  TRANSLATION_READ: 'translation:read',
  TRANSLATION_MANAGE: 'translation:manage',
  // API key đối tác
  APIKEY_READ: 'apikey:read',
  APIKEY_MANAGE: 'apikey:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Tất cả permission (để seed role admin). */
export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

/** Quyền mặc định theo role — nguồn seed ở PR #C. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  [RoleKey.ADMIN]: ALL_PERMISSIONS,
  [RoleKey.MODERATOR]: [
    PERMISSIONS.ROOM_READ,
    PERMISSIONS.EXHIBIT_READ,
    PERMISSIONS.REVISION_PUBLISH,
    PERMISSIONS.REVISION_REJECT,
    PERMISSIONS.REVISION_HIDE,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_RESOLVE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.PERMISSION_READ,
  ],
  [RoleKey.EDITOR]: [
    PERMISSIONS.ROOM_READ,
    PERMISSIONS.ROOM_CREATE,
    PERMISSIONS.ROOM_UPDATE,
    PERMISSIONS.ROOM_DELETE,
    PERMISSIONS.EXHIBIT_READ,
    PERMISSIONS.EXHIBIT_CREATE,
    PERMISSIONS.EXHIBIT_UPDATE,
    PERMISSIONS.REVISION_CREATE,
    PERMISSIONS.REVISION_SUBMIT,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_ATTACH,
  ],
};
