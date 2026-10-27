import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';

export type RoomStatus = 'active' | 'archived';

export interface RoomRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: RoomStatus;
  exhibitsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListRoomsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: RoomStatus;
}

export interface CreateRoomInput {
  slug: string;
  name: string;
  description?: string;
}

export interface UpdateRoomInput {
  name?: string;
  description?: string;
  status?: RoomStatus;
}

export const roomsService = {
  list(params: ListRoomsParams): Promise<Page<RoomRow>> {
    return http.getPage<RoomRow>('/admin/rooms', { params });
  },

  get(id: string): Promise<RoomRow> {
    return http.get<RoomRow>(`/admin/rooms/${id}`);
  },

  create(input: CreateRoomInput): Promise<RoomRow> {
    return http.post<RoomRow>('/admin/rooms', input);
  },

  update(id: string, input: UpdateRoomInput): Promise<RoomRow> {
    return http.patch<RoomRow>(`/admin/rooms/${id}`, input);
  },

  remove(id: string): Promise<void> {
    return http.delete<void>(`/admin/rooms/${id}`);
  },
  /** Xóa mềm nhiều phòng: tất cả hoặc không (409 kèm lý do từng ID). */
  async removeMany(ids: string[]): Promise<void> {
    await http.post<unknown>('/admin/rooms/bulk-delete', { ids });
  },

  getPublicList(): Promise<RoomRow[]> {
    return http.get<RoomRow[]>('/public/rooms');
  },

  getPublicBySlug(slug: string): Promise<RoomRow> {
    return http.get<RoomRow>(`/public/rooms/${slug}`);
  },
};
