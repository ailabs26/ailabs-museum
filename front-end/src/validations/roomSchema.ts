import { z } from 'zod';

const roomSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
});

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
  // The public service currently exposes no media DTO. Do not guess URL fields.
  model: z.null(), image: z.null(), audio: z.null(),
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
  room.exhibits.every((exhibit) => exhibit.roomId === room.id) &&
  new Set(room.exhibits.map((exhibit) => exhibit.id)).size === room.exhibits.length,
'Exhibits must belong to this room and have unique identities');

export function roomResponseSchema<Schema extends z.ZodTypeAny>(dataSchema: Schema) {
  return z.object({ success: z.literal(true), data: dataSchema, message: z.string().nullable() });
}

export type RoomSummary = z.infer<typeof roomSummarySchema>;
export type RoomDetail = z.infer<typeof roomDetailSchema>;
