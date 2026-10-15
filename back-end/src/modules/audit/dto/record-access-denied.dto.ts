import type { PermissionKey } from '../../../common/constants/permissions.constant';

export interface RecordAccessDeniedInput {
  actorId: string | null;
  method: string;
  route: string;
  requiredPermissions: readonly PermissionKey[];
  missingPermissions: readonly PermissionKey[];
  requestId: string;
}
