import { ForbiddenException } from '@nestjs/common';
import type { PermissionKey } from '../constants/permissions.constant';

/** Lỗi RBAC có dữ liệu audit do server xác định, không lấy từ request body. */
export class PermissionDeniedException extends ForbiddenException {
  readonly requiredPermissions: readonly PermissionKey[];
  readonly missingPermissions: readonly PermissionKey[];

  constructor(required: readonly PermissionKey[], missing: readonly PermissionKey[]) {
    super(`Thiếu quyền: ${missing.join(', ')}`);
    this.requiredPermissions = [...required];
    this.missingPermissions = [...missing];
  }
}
