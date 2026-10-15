import { z } from 'zod';

const roomSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
});

export const publicModelSchema = z.object({
  id: z.string().uuid(),
  storageKey: z.string().min(1).max(512).regex(/^[a-zA-Z0-9_/-]+\.glb$/)
    .refine(key => key.split('/').every(part => part.length > 0 && part !== '..' && part !== '.')),
  sizeBytes: z.number().int().positive().max(128 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.string().regex(/^\/rooms\/[a-zA-Z0-9_-]+\/exhibits\/[a-f0-9-]+\/model\?version=[a-f0-9]{64}$/),
});
export type PublicModel = z.infer<typeof publicModelSchema>;

const exhibitSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  displayOrder: z.number().int().nonnegative(),
  name: z.string().min(1).max(200),
  description: z.string(),
  positionX: z.number().finite().optional(),
  positionY: z.number().finite().optional(),
  positionZ: z.number().finite().optional(),
  transcript: z.string().nullable(),
  placeholderShape: z.enum(['box', 'sphere', 'cylinder', 'cone', 'torus']),
  placeholderColor: z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{6})$/i),
  model: publicModelSchema.nullable(), image: z.null(), audio: z.null(),
  hotspots: z.array(z.object({
    id: z.string().uuid(), label: z.string(), body: z.string(),
    positionX: z.number().finite(), positionY: z.number().finite(), positionZ: z.number().finite(),
    displayOrder: z.number().int().nonnegative(),
  })),
}).refine((exhibit) => {
  const coordinates = [exhibit.positionX, exhibit.positionY, exhibit.positionZ];
  return coordinates.every((value) => value === undefined) || coordinates.every((value) => value !== undefined);
}, 'Exhibit coordinates must be complete or absent');

export const roomListSchema = z.array(roomSummarySchema).refine((rooms) =>
  new Set(rooms.map((room) => room.id)).size === rooms.length &&
  new Set(rooms.map((room) => room.slug)).size === rooms.length,
'Room identities must be unique');

export const roomDetailSchema = roomSummarySchema.extend({
  exhibits: z.array(exhibitSchema),
}).refine((room) =>
  room.exhibits.every((exhibit) => exhibit.roomId === room.id && (!exhibit.model
    || exhibit.model.url === `/rooms/${encodeURIComponent(room.slug)}/exhibits/${exhibit.id}/model?version=${exhibit.model.checksumSha256}`)) &&
  new Set(room.exhibits.map((exhibit) => exhibit.id)).size === room.exhibits.length,
'Exhibits must belong to this room and have unique identities');

export function roomResponseSchema<Schema extends z.ZodTypeAny>(dataSchema: Schema) {
  return z.object({ success: z.literal(true), data: dataSchema, message: z.string().nullable() });
}

export type RoomSummary = z.infer<typeof roomSummarySchema>;
export type RoomDetail = z.infer<typeof roomDetailSchema>;
