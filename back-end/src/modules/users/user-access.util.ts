import { AuthUser } from '../../common/types/auth-user.type';
import { User } from './entities/user.entity';

/**
 * Gộp roles + permissions của user từ các quan hệ đã nạp
 * (userRoles → role → rolePermissions → permission).
 * Yêu cầu user được load kèm ACCESS_RELATIONS (xem UsersRepository).
 */
export function toAuthUser(user: User): AuthUser {
  const roles: string[] = [];
  const permissions = new Set<string>();

  for (const userRole of user.userRoles ?? []) {
    const role = userRole.role;
    if (!role) continue;
    roles.push(role.code);
    for (const rolePermission of role.rolePermissions ?? []) {
      const code = rolePermission.permission?.code;
      if (code) permissions.add(code);
    }
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles,
    permissions: [...permissions],
  };
}
