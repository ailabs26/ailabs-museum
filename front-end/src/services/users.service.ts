import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';
import { ApiException } from '@/core/api/api-error';
import { userListResponseSchema, userResponseSchema } from '@/validations/userSchema';
import type { UserRow } from '@/validations/userSchema';

export type { UserRow } from '@/validations/userSchema';

export type UserStatus = 'active' | 'disabled';

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: UserStatus;
  /** true: mục Đã xóa (thùng rác). */
  deleted?: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  displayName?: string;
  status?: UserStatus;
  password?: string;
  roleIds?: string[];
}

function parseUser(value: unknown): UserRow {
  const result = userResponseSchema.safeParse(value);
  if (!result.success) throw new ApiException('Dữ liệu tài khoản từ máy chủ không hợp lệ', 502);
  return result.data.data;
}

export const usersService = {
  async list(params: ListUsersParams): Promise<Page<UserRow>> {
    const response = await http.raw.get<unknown>('/users', { params });
    const result = userListResponseSchema.safeParse(response.data);
    if (!result.success) throw new ApiException('Danh sách tài khoản từ máy chủ không hợp lệ', 502);
    return { items: result.data.data, ...result.data.meta };
  },
  async get(id: string): Promise<UserRow> {
    return parseUser((await http.raw.get<unknown>(`/users/${id}`)).data);
  },
  async create(input: CreateUserInput): Promise<UserRow> {
    return parseUser((await http.raw.post<unknown>('/users', input)).data);
  },
  async update(id: string, input: UpdateUserInput): Promise<UserRow> {
    return parseUser((await http.raw.patch<unknown>(`/users/${id}`, input)).data);
  },
  remove(id: string): Promise<void> {
    return http.delete<void>(`/users/${id}`);
  },
  /** Xóa mềm nhiều tài khoản: tất cả hoặc không (409 kèm lý do từng ID). */
  async removeMany(ids: string[]): Promise<void> {
    await http.post<unknown>('/users/bulk-delete', { ids });
  },
  /** Khôi phục tài khoản đã xóa: tất cả hoặc không (409 kèm lý do từng ID). */
  async restoreMany(ids: string[]): Promise<void> {
    await http.post<unknown>('/users/bulk-restore', { ids });
  },
  async assignRoles(id: string, roleIds: string[]): Promise<UserRow> {
    return parseUser((await http.raw.post<unknown>(`/users/${id}/roles`, { roleIds })).data);
  },
  async setRoles(id: string, roleIds: string[]): Promise<UserRow> {
    return parseUser((await http.raw.put<unknown>(`/users/${id}/roles`, { roleIds })).data);
  },
  async removeRole(id: string, roleId: string): Promise<UserRow> {
    return parseUser((await http.raw.delete<unknown>(`/users/${id}/roles/${roleId}`)).data);
  },
};
