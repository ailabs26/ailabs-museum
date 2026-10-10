import { Role } from '../role.entity';

export interface RoleResponse {
  id: string;
  code: string;
  name: string;
  permissions: string[];
}

export function toRoleResponse(role: Role): RoleResponse {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    permissions: (role.rolePermissions ?? [])
      .map((rolePermission) => rolePermission.permission?.code)
      .filter((code): code is string => Boolean(code))
      .sort(),
  };
}
