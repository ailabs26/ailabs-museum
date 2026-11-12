import { describe, expect, it } from 'vitest';
import { GALLERY_SLOTS } from './gallerySlots';
import { getGalleryAccents, getGallerySpots, type GalleryLightTarget } from './galleryLighting';

describe('gallery light rig', () => {
  it('aims one neutral-warm spot at every plinth on the balanced tier', () => {
    const spots = getGallerySpots('balanced');
    expect(spots.map(spot => spot.id)).toEqual(GALLERY_SLOTS.map(slot => slot.id));
    spots.forEach((spot, index) => {
      const [x, , z] = GALLERY_SLOTS[index].position;
      expect([spot.target[0], spot.target[2]]).toEqual([x, z]);
      expect(spot.position[1]).toBeLessThan(5);
      expect(spot.position[2]).toBeGreaterThan(z);
      expect(spot.color).toBe('#ffe8cc');
    });
    expect(spots[0].intensity).toBeGreaterThan(spots[1].intensity);
  });

  it('reduces to three spots and drops coloured accents on the low tier', () => {
    expect(getGallerySpots('low').map(spot => spot.id)).toEqual(['S01', 'left', 'right']);
    expect(getGalleryAccents('low')).toEqual([]);
    expect(getGalleryAccents('balanced').map(accent => accent.id)).toEqual(['jade', 'midnight-blue']);
  });

  it('keeps coloured accents on the side walls, away from every plinth', () => {
    for (const accent of getGalleryAccents('balanced')) {
      expect(Math.abs(accent.position[0])).toBeGreaterThan(6);
      for (const slot of GALLERY_SLOTS) {
        expect(Math.hypot(accent.position[0] - slot.position[0], accent.position[2] - slot.position[2])).toBeGreaterThan(1.8);
      }
    }
  });
});

describe('free-placement (legacy) rooms', () => {
  const at = (id: string, x: number, z: number, isHero = false): GalleryLightTarget => ({ id, position: [x, 0, z], isHero });

  it('aims one spot at each real exhibit, keeping fixtures inside the ceiling', () => {
    const targets = [at('a', -5.3, -5.1), at('b', 0, 0, true), at('c', 5.3, 6.5)];
    const spots = getGallerySpots('balanced', targets);
    expect(spots.map(spot => spot.id)).toEqual(['a', 'b', 'c']);
    expect(spots.map(spot => [spot.target[0], spot.target[2]])).toEqual([[-5.3, -5.1], [0, 0], [5.3, 6.5]]);
    expect(spots[1].intensity).toBeGreaterThan(spots[0].intensity);
    expect(spots[2].position[2]).toBeLessThanOrEqual(7.4);
  });

  it('switches to the fixed broad rig above five exhibits instead of adding lights', () => {
    const targets = Array.from({ length: 9 }, (_, index) => at(`e${index}`, index - 4, 0));
    expect(getGallerySpots('balanced', targets).map(spot => spot.id)).toEqual(['S01', 'left', 'right']);
  });

  it('drops a coloured accent that would tint a nearby exhibit', () => {
    expect(getGalleryAccents('balanced', [at('near-jade', -5.5, -1)]).map(accent => accent.id)).toEqual(['midnight-blue']);
    expect(getGalleryAccents('balanced', [at('far', 0, 5)]).map(accent => accent.id)).toEqual(['jade', 'midnight-blue']);
  });
});
