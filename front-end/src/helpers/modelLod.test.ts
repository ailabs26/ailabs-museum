import { expect, it } from 'vitest';
import { projectedModelPixels, selectModelLod, modelLodSetSchema } from './modelLod';

const thresholds = { lod0Pixels: 480, lod1Pixels: 160, hysteresis: 0.15 };

it('selects screen-space detail using model size, FOV, viewport and pixel ratio', () => {
  const pixels = projectedModelPixels(1, 10, 60, 900, 1);
  expect(pixels).toBeCloseTo(156.67, 1);
  expect(projectedModelPixels(2, 10, 60, 900, 1)).toBeGreaterThan(pixels * 2);
  expect(projectedModelPixels(1, 10, 60, 900, 1.5)).toBeCloseTo(pixels * 1.5);
  expect(projectedModelPixels(1, 0.5, 60, 900, 1)).toBe(Infinity);
  expect(selectModelLod(600, 2, false, thresholds)).toBe(0);
  expect(selectModelLod(250, 0, false, thresholds)).toBe(1);
  expect(selectModelLod(100, 1, false, thresholds)).toBe(2);
  expect(selectModelLod(1, 2, true, thresholds)).toBe(0);
});

it('holds each level through oscillation and upgrades on entering the approved distance', () => {
  let level: 0 | 1 | 2 = 1;
  for (const pixels of [158, 163, 156, 172, 150, 162]) level = selectModelLod(pixels, level, false, thresholds);
  expect(level).toBe(1);
  expect(selectModelLod(135, level, false, thresholds)).toBe(2);
  expect(selectModelLod(159, 2, false, thresholds)).toBe(2);
  // Upgrade immediately at the reviewed threshold, downgrade only beyond hysteresis.
  expect(selectModelLod(160, 2, false, thresholds)).toBe(1);
  expect(selectModelLod(480, 1, false, thresholds)).toBe(0);
});

it('fails safe to full detail on invalid projection inputs', () => {
  for (const radius of [0, -1, NaN, Infinity]) expect(projectedModelPixels(radius, 10, 60, 900, 1)).toBe(Infinity);
  expect(selectModelLod(NaN, 2, false, thresholds)).toBe(0);
});

it('requires reviewed thresholds and master normalization in a runtime variant set', () => {
  expect(modelLodSetSchema.safeParse({ sourceChecksumSha256: 'a'.repeat(64), levels: [] }).success).toBe(false);
});
