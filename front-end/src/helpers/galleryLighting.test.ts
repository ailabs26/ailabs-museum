import { describe, expect, it } from 'vitest';
import { GALLERY_SLOTS } from './gallerySlots';
import { getGalleryAccents, getGallerySpots } from './galleryLighting';

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
