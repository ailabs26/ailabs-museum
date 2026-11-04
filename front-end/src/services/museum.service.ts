import type { z } from 'zod';
import { http } from '@/core/api/http-client';
import { ApiException } from '@/core/api/api-error';
import { exhibitSearchResponseSchema, roomDetailSchema, roomListSchema, roomResponseSchema } from '@/validations/roomSchema';
import type { PublicModel, RoomSummary } from '@/validations/roomSchema';

async function readPublicContent<Schema extends z.ZodTypeAny>(url: string, schema: Schema, signal?: AbortSignal): Promise<z.infer<Schema>> {
  // Reuse the existing Axios instance; raw preserves the envelope for validation.
  const response = await http.raw.get<unknown>(url, { signal });
  const parsed = roomResponseSchema(schema).safeParse(response.data);
  if (!parsed.success) throw new ApiException('Dữ liệu phòng không hợp lệ từ máy chủ.', 502);
  return parsed.data.data;
}

const SEARCH_PAGE_SIZE = 12;

export const museumService = {
  async getModelBinary(model: PublicModel, signal: AbortSignal, onProgress: (ratio: number) => void) {
    const response = await http.raw.get<ArrayBuffer>(model.url, {
      signal, responseType: 'arraybuffer', timeout: 120_000,
      onDownloadProgress: ({ loaded }) => onProgress(Math.min(1, loaded / model.sizeBytes)),
    });
    if (!(response.data instanceof ArrayBuffer) || response.data.byteLength !== model.sizeBytes) {
      throw new ApiException('Tệp mô hình không đầy đủ.', 502);
    }
    return response.data;
  },
  /** Tìm hiện vật đã xuất bản trên toàn bảo tàng (phân trang). */
  async searchExhibits(q: string, page: number, signal?: AbortSignal) {
    const response = await http.raw.get<unknown>('/rooms/search', { params: { q, page, pageSize: SEARCH_PAGE_SIZE }, signal });
    const parsed = exhibitSearchResponseSchema.safeParse(response.data);
    if (!parsed.success) throw new ApiException('Dữ liệu tìm kiếm không hợp lệ từ máy chủ.', 502);
    return { items: parsed.data.data, ...parsed.data.meta };
  },
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
