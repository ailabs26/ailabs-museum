import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';

export type UserStatus = 'active' | 'disabled';

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: UserStatus;
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
}

export const usersService = {
  list(params: ListUsersParams): Promise<Page<UserRow>> {
    return http.getPage<UserRow>('/users', { params });
  },
  get(id: string): Promise<UserRow> {
    return http.get<UserRow>(`/users/${id}`);
  },
  create(input: CreateUserInput): Promise<UserRow> {
    return http.post<UserRow>('/users', input);
  },
  update(id: string, input: UpdateUserInput): Promise<UserRow> {
    return http.patch<UserRow>(`/users/${id}`, input);
  },
  remove(id: string): Promise<void> {
    return http.delete<void>(`/users/${id}`);
  },
  assignRoles(id: string, roleIds: string[]): Promise<UserRow> {
    return http.post<UserRow>(`/users/${id}/roles`, { roleIds });
  },
  removeRole(id: string, roleId: string): Promise<UserRow> {
    return http.delete<UserRow>(`/users/${id}/roles/${roleId}`);
  },
};
