import { z } from 'zod';
import { appConfig } from '@/config/env';
import { publicModelSchema } from './glbSchema';
import type { PublicRoomPayload } from './museumTypes';

const roomSummarySchema = z.object({
  id: z.string().uuid(), slug: z.string().min(1), name: z.string().min(1),
  description: z.string().nullable(),
});
const vec3Schema = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
const exhibitSchema = z.object({
  id: z.string().uuid(), roomId: z.string().uuid(), revisionId: z.string().uuid().optional(),
  displayOrder: z.number().int().nonnegative(), name: z.string().min(1), description: z.string(),
  positionX: z.number().finite().optional(), positionY: z.number().finite().optional(), positionZ: z.number().finite().optional(),
  rotation: vec3Schema.optional(), scale: vec3Schema.optional(),
  placeholderShape: z.enum(['box', 'sphere', 'cylinder', 'cone', 'torus']),
  placeholderColor: z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{6})$/i),
  model: publicModelSchema.nullable().optional(),
  hotspots: z.array(z.object({
    id: z.string().uuid(), label: z.string(), body: z.string(),
    positionX: z.number().finite(), positionY: z.number().finite(), positionZ: z.number().finite(),
    displayOrder: z.number().int().nonnegative(),
  })).optional(),
  i18n: z.record(z.object({ name: z.string().nullable(), description: z.string().nullable() })).optional(),
}).refine((item) => {
  const coords = [item.positionX, item.positionY, item.positionZ];
  return coords.every((v) => v === undefined) || coords.every((v) => v !== undefined);
});
const roomDetailSchema = roomSummarySchema.extend({ exhibits: z.array(exhibitSchema) }).refine((room) =>
  room.exhibits.every((item) => item.roomId === room.id && (!item.model ||
    item.model.url === `/rooms/${encodeURIComponent(room.slug)}/exhibits/${item.id}/model?version=${item.model.checksumSha256}`)) &&
  new Set(room.exhibits.map((item) => item.id)).size === room.exhibits.length,
);
const responseSchema = <T extends z.ZodTypeAny>(data: T) => z.object({ success: z.literal(true), data });

async function readPublicContent<T extends z.ZodTypeAny>(path: string, schema: T, signal?: AbortSignal): Promise<z.infer<T>> {
  const response = await fetch(`${appConfig.apiUrl.replace(/\/+$/, '')}${path}`, {
    headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw new Error(response.status === 404 ? 'Không tìm thấy phòng trưng bày.' : `API trả lỗi ${response.status}.`);
  const parsed = responseSchema(schema).safeParse(await response.json());
  if (!parsed.success) throw new Error('Dữ liệu phòng từ API không hợp lệ.');
  return parsed.data.data;
}

export type PublicRoomSummary = z.infer<typeof roomSummarySchema>;

export const publicRoomApi = {
  list(signal?: AbortSignal): Promise<PublicRoomSummary[]> {
    return readPublicContent('/rooms', z.array(roomSummarySchema), signal);
  },
  async detail(slug: string, signal?: AbortSignal): Promise<PublicRoomPayload> {
    const room = await readPublicContent(`/rooms/${encodeURIComponent(slug)}`, roomDetailSchema, signal);
    if (room.slug !== slug) throw new Error('API trả sai phòng trưng bày.');
    return room as PublicRoomPayload;
  },
};
