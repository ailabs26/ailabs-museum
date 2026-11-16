import { z } from 'zod';
import { publicModelSchema } from '@/validations/roomSchema';

const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

/** Offline candidates can be exercised in fixtures before the publication contract is approved. */
export const modelLodSetSchema = z.object({
  usage: z.literal('fixture'),
  sourceChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  normalization: z.object({
    scale: z.number().finite().min(1e-6).max(1e6), offset: vector,
    size: vector.refine(size => size.every(value => value >= 0) && Math.hypot(...size) > 0),
    center: vector, radius: z.number().finite().positive(),
  }),
  thresholds: z.object({
    lod0Pixels: z.number().finite().positive(), lod1Pixels: z.number().finite().positive(),
    hysteresis: z.number().finite().min(0.05).max(0.4),
  }).refine(value => value.lod0Pixels > value.lod1Pixels),
  levels: z.array(z.object({ level: z.union([z.literal(0), z.literal(1), z.literal(2)]), model: publicModelSchema })).min(1).max(3)
    .refine(levels => new Set(levels.map(value => value.level)).size === levels.length),
});

export type ModelLodSet = z.infer<typeof modelLodSetSchema>;
export type ModelLodLevel = 0 | 1 | 2;

/** Conservative projected bounding sphere diameter in physical pixels. */
export function projectedModelPixels(radius: number, distance: number, fovDegrees: number, height: number, dpr: number): number {
  if (![radius, distance, fovDegrees, height, dpr].every(Number.isFinite)
    || radius <= 0 || distance <= radius || fovDegrees <= 0 || fovDegrees >= 180 || height <= 0 || dpr <= 0) return Infinity;
  return height * dpr * radius / (Math.sqrt(distance * distance - radius * radius) * Math.tan(fovDegrees * Math.PI / 360));
}

/** Upgrade at the reviewed threshold. Downgrade later to protect fidelity while avoiding oscillation. */
export function selectModelLod(pixels: number, current: ModelLodLevel, focused: boolean, thresholds: ModelLodSet['thresholds']): ModelLodLevel {
  if (focused || !Number.isFinite(pixels)) return 0;
  const { lod0Pixels, lod1Pixels, hysteresis } = thresholds;
  if (pixels >= lod0Pixels || (current === 0 && pixels >= lod0Pixels * (1 - hysteresis))) return 0;
  if (pixels >= lod1Pixels || (current <= 1 && pixels >= lod1Pixels * (1 - hysteresis))) return 1;
  return 2;
}
