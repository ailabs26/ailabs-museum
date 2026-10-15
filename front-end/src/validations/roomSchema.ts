import { z } from 'zod';

const roomSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
});

/** Absolute http(s) URL issued by the API's managed media route; never a relative or script URL. */
const mediaUrlSchema = z.string().url().refine((value) => /^https?:\/\//i.test(value), 'Media URL must be absolute http(s)');

const mediaSchema = z.object({
  id: z.string().uuid(),
  url: mediaUrlSchema,
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  rights: z.object({ source: z.string().nullable(), author: z.string().nullable(), license: z.string().nullable() }),
});

const bilingualSchema = z.object({ vi: z.string().nullable(), en: z.string().nullable() });

const audioTrackSchema = z.object({
  audio: mediaSchema,
  subtitle: mediaSchema.nullable(),
  transcript: z.string().nullable(),
});

const localizedTextSchema = z.object({
  name: z.string().nullable(),
  description: z.string().nullable(),
  transcript: z.string().nullable(),
});

const vector3Schema = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });

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
  // Bilingual copy and full transform (Task 9); optional so older payloads stay valid.
  i18n: z.object({ vi: localizedTextSchema, en: localizedTextSchema }).optional(),
  rotation: vector3Schema.optional(),
  scale: vector3Schema.refine(({ x, y, z }) => x > 0 && y > 0 && z > 0, 'Scale must be positive').optional(),
  placeholderShape: z.enum(['box', 'sphere', 'cylinder', 'cone', 'torus']),
  placeholderColor: z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{6})$/i),
  // Media of the current published revision only; per-locale audio never falls back to another language.
  model: mediaSchema.nullable(),
  image: mediaSchema.extend({ altText: bilingualSchema }).nullable(),
  audio: z.object({ vi: audioTrackSchema.nullable(), en: audioTrackSchema.nullable() }).nullable(),
  hotspots: z.array(z.object({
    id: z.string().uuid(), label: z.string(), body: z.string(),
    i18n: z.object({
      vi: z.object({ label: z.string().nullable(), body: z.string().nullable() }),
      en: z.object({ label: z.string().nullable(), body: z.string().nullable() }),
    }).optional(),
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
