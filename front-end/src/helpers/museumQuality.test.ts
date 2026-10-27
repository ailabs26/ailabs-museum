import { describe, expect, it } from 'vitest';
import { getMuseumQuality } from './museumQuality';

describe('museum rendering quality', () => {
  it('caps desktop DPR, shadows and texture filtering', () => {
    expect(getMuseumQuality({ cores: 8, memory: 8, width: 1440, isCoarse: false })).toEqual({ tier: 'balanced', dpr: 1.5, shadowSize: 1024, anisotropy: 4 });
  });
  it('keeps small touch and constrained hardware on a lightweight tier', () => {
    for (const hints of [{ cores: 2, width: 1440 }, { memory: 2, width: 1440 }, { width: 390, isCoarse: true }]) {
      expect(getMuseumQuality(hints)).toEqual({ tier: 'low', dpr: 1, shadowSize: 0, anisotropy: 2 });
    }
  });
  it('uses bounded defaults when capability hints are absent', () => {
    expect(getMuseumQuality({}).dpr).toBeLessThanOrEqual(1.5);
    expect(getMuseumQuality({ memory: 0, cores: 0 }).shadowSize).toBeLessThanOrEqual(1024);
  });
});
