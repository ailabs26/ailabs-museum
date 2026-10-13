import { http } from '@/core/api/http-client';
import { z } from 'zod';
import { ApiException } from '@/core/api/api-error';

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

const roleListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.object({
    id: z.string().uuid(),
    code: z.string().min(1),
    name: z.string(),
    permissions: z.array(z.string()),
  })),
});

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
