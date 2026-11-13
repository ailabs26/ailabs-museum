import { describe, expect, it } from 'vitest';
import { guidedTour2dDetailPath, guidedTour3dPath } from './guidedTour2dNavigation';

describe('guidedTour2dDetailPath', () => {
  it('encodes the room slug and keeps the exhibit ID in the canonical detail route', () => {
    expect(guidedTour2dDetailPath('gallery room/a', 'exhibit-id'))
      .toBe('/collection/gallery%20room%2Fa/exhibits/exhibit-id');
  });
});

describe('guidedTour3dPath', () => {
  it('encodes the room slug and current exhibit in the public tour query', () => {
    expect(guidedTour3dPath('gallery room/a', 'exhibit id'))
      .toBe('/tour?room=gallery+room%2Fa&exhibit=exhibit+id');
  });
});
