import { describe, expect, it } from 'vitest';
import { guidedTour2dDetailPath } from './guidedTour2dNavigation';

describe('guidedTour2dDetailPath', () => {
  it('encodes the room slug and keeps the exhibit ID in the canonical detail route', () => {
    expect(guidedTour2dDetailPath('gallery room/a', 'exhibit-id'))
      .toBe('/collection/gallery%20room%2Fa/exhibits/exhibit-id');
  });
});
