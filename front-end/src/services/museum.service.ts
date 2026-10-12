import type { z } from 'zod';
import { http } from '@/core/api/http-client';
import { ApiException } from '@/core/api/api-error';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '@/validations/roomSchema';
import type { RoomSummary } from '@/validations/roomSchema';

async function readPublicContent<Schema extends z.ZodTypeAny>(url: string, schema: Schema, signal?: AbortSignal): Promise<z.infer<Schema>> {
  // Reuse the existing Axios instance; raw preserves the envelope for validation.
  const response = await http.raw.get<unknown>(url, { signal });
  const parsed = roomResponseSchema(schema).safeParse(response.data);
  if (!parsed.success) throw new ApiException('Dữ liệu phòng không hợp lệ từ máy chủ.', 502);
  return parsed.data.data;
}

export const museumService = {
  listRooms(signal?: AbortSignal) {
    return readPublicContent('/rooms', roomListSchema, signal);
  },
  async getRoom(room: RoomSummary, signal?: AbortSignal) {
    const detail = await readPublicContent(`/rooms/${encodeURIComponent(room.slug)}`, roomDetailSchema, signal);
    if (detail.id !== room.id || detail.slug !== room.slug) {
      throw new ApiException('Dữ liệu phòng không hợp lệ: phản hồi không khớp phòng được chọn.', 502);
    }
    return detail;
  },
};
