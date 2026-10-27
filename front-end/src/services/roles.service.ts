import { http } from '@/core/api/http-client';
import { ApiException } from '@/core/api/api-error';
import {
  permissionListResponseSchema,
  permissionMatrixResponseSchema,
  roleListResponseSchema,
} from '@/validations/rolePermissionSchema';

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

export interface PermissionMatrixUpdate {
  roleId: string;
  permissions: string[];
}

export const rolesService = {
  async list(): Promise<RoleRow[]> {
    const response = await http.raw.get<unknown>('/roles');
    const result = roleListResponseSchema.safeParse(response.data);
    if (!result.success) throw new ApiException('Danh sách vai trò từ máy chủ không hợp lệ', 502);
    return result.data.data;
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
  /** Xóa mềm nhiều vai trò: tất cả hoặc không (409 kèm lý do từng ID). */
  async removeMany(ids: string[]): Promise<void> {
    await http.post<unknown>('/roles/bulk-delete', { ids });
  },
  getPermissions(id: string): Promise<string[]> {
    return http.get<string[]>(`/roles/${id}/permissions`);
  },
  setPermissions(id: string, permissions: string[]): Promise<RoleRow> {
    return http.put<RoleRow>(`/roles/${id}/permissions`, { permissions });
  },
  listAllPermissions(): Promise<PermissionRow[]> {
    return getValidatedPermissions();
  },
  async setPermissionMatrix(updates: PermissionMatrixUpdate[]): Promise<RoleRow[]> {
    const response = await http.raw.put<unknown>('/roles/permission-matrix', { updates });
    const result = permissionMatrixResponseSchema.safeParse(response.data);
    if (!result.success) throw new ApiException('Ma trận quyền từ máy chủ không hợp lệ', 502);
    return result.data.data.roles;
  },
};

async function getValidatedPermissions(): Promise<PermissionRow[]> {
  const response = await http.raw.get<unknown>('/permissions');
  const result = permissionListResponseSchema.safeParse(response.data);
  if (!result.success) throw new ApiException('Danh sách quyền từ máy chủ không hợp lệ', 502);
  return result.data.data;
}
