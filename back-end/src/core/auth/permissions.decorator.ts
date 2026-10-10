import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../../common/constants/permissions.constant';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Khai báo quyền cần có để gọi route. PermissionsGuard sẽ kiểm tra.
 * @example @Permissions(PERMISSIONS.EXHIBIT_UPDATE)
 */
export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
