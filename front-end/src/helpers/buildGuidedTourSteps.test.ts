import { describe, expect, it } from 'vitest';
import type { RoomDetail } from '@/validations/roomSchema';
import { buildGuidedTourSteps } from './buildGuidedTourSteps';

const roomId = '00000000-0000-4000-8000-000000000001';
const room: RoomDetail = {
  id: roomId,
  slug: 'sculpture',
  name: 'Sculpture',
  description: null,
  exhibits: [],
};

function exhibit(id: string, displayOrder: number) {
  return {
    id,
    revisionId: `20000000-0000-4000-8000-${id.slice(-12)}`,
    roomId,
    displayOrder,
    name: id,
    description: `Description ${id}`,
    transcript: null,
    placeholderShape: 'box' as const,
    placeholderColor: '#8b7355',
    model: null,
    image: null,
    audio: null,
    hotspots: [],
  };
}

describe('buildGuidedTourSteps', () => {
  it('returns no steps for a public room without exhibits', () => {
    expect(buildGuidedTourSteps(room)).toEqual([]);
  });

  it('orders steps by displayOrder then exhibit ID without mutating the room', () => {
    const input = [exhibit('c', 2), exhibit('b', 1), exhibit('a', 2)];
    const snapshot = [...input];
    const result = buildGuidedTourSteps({ ...room, exhibits: input });

    expect(result).toEqual([
      { roomId, exhibitId: 'b' },
      { roomId, exhibitId: 'a' },
      { roomId, exhibitId: 'c' },
    ]);
    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
  });

  it('keeps stable IDs when localized exhibit text changes', () => {
    const original = { ...room, exhibits: [exhibit('a', 1), exhibit('b', 2)] };
    const translated = {
      ...original,
      exhibits: original.exhibits.map((item) => ({ ...item, name: 'Translated', description: 'Translated' })),
    };

    expect(buildGuidedTourSteps(translated)).toEqual(buildGuidedTourSteps(original));
  });
});
