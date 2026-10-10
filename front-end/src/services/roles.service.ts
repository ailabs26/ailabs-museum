import { http } from '@/core/api/http-client';

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  permissions: string[];
}

export interface PermissionRow {
  id: string;
  code: string;
  description: string | null;
}

export interface CreateRoleInput {
  code: string;
  name: string;
}

export const rolesService = {
  list(): Promise<RoleRow[]> {
    return http.get<RoleRow[]>('/roles');
  },
  create(input: CreateRoleInput): Promise<RoleRow> {
    return http.post<RoleRow>('/roles', input);
  },
  update(id: string, name: string): Promise<RoleRow> {
    return http.patch<RoleRow>(`/roles/${id}`, { name });
  },
  remove(id: string): Promise<void> {
    return http.delete<void>(`/roles/${id}`);
  },
  getPermissions(id: string): Promise<string[]> {
    return http.get<string[]>(`/roles/${id}/permissions`);
  },
  setPermissions(id: string, permissions: string[]): Promise<RoleRow> {
    return http.put<RoleRow>(`/roles/${id}/permissions`, { permissions });
  },
  listAllPermissions(): Promise<PermissionRow[]> {
    return http.get<PermissionRow[]>('/permissions');
  },
};
