import { expect, test } from '@playwright/test';
import { getExhibitView, getOrbitLimit } from '../src/helpers/museumCamera';
import type { MuseumDisplay } from '../src/interfaces/museumScene';

const display: MuseumDisplay = { id: 'artifact', title: 'Artifact', description: '', position: [0, 0, 0], shape: 'torus', color: '#8b7355' };

test('focus safely frames centre, wall and corner exhibits without moving their coordinates', () => {
  for (const position of [[0, 0, 0], [-5.3, 0, -5.1], [5.3, 0, 5.1], [-5.3, 1, 5.1]] as [number, number, number][]) {
    const input = { ...display, position, shape: 'sphere' as const };
    const view = getExhibitView(input)!;
    expect(input.position).toEqual(position);
    expect(Math.abs(view.position[0])).toBeLessThan(6.6);
    expect(Math.abs(view.position[2])).toBeLessThan(7.6);
    expect(view.position[1]).toBeGreaterThan(0.4);
    expect(view.position[1]).toBeLessThan(4.6);
    // Entire allowed orbit, not just the initial focus point, stays in the room.
    const radius = getOrbitLimit(view.target);
    expect(radius).toBeGreaterThanOrEqual(2.2);
    expect(Math.abs(view.target[0]) + radius).toBeLessThanOrEqual(6.6);
    expect(Math.abs(view.target[2]) + radius).toBeLessThanOrEqual(7.6);
    expect(view.target[1] + radius * Math.cos(1.25)).toBeLessThanOrEqual(4.6);
  }
});

test('outside-room or below-floor exhibits have no camera focus destination', () => {
  expect(getExhibitView({ ...display, position: [20, 0, 0] })).toBeNull();
  expect(getExhibitView({ ...display, position: [0, -1, 0] })).toBeNull();
  expect(getExhibitView({ ...display, isOutsideRoom: true })).toBeNull();
});
