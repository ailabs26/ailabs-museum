export interface MuseumQuality { tier: 'low' | 'balanced'; dpr: number; shadowSize: number; anisotropy: number }

/** Capability hints are optional; both tiers retain PBR, antialiasing and contact grounding. */
export function getMuseumQuality({ cores, memory, width, isCoarse }: {
  cores?: number; memory?: number; width?: number; isCoarse?: boolean;
}): MuseumQuality {
  const isConstrained = (cores !== undefined && cores > 0 && cores <= 4)
    || (memory !== undefined && memory > 0 && memory <= 4) || (isCoarse && (width ?? 0) <= 900);
  return isConstrained ? { tier: 'low', dpr: 1, shadowSize: 0, anisotropy: 2 }
    : { tier: 'balanced', dpr: 1.5, shadowSize: 1024, anisotropy: 4 };
}
