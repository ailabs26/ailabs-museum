import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { getExhibitView } from './museumCamera';
import type { MuseumDisplay } from '../interfaces/museumScene';

it('frames actual normalized bounds in landscape and portrait inside the walls', () => {
  const display: MuseumDisplay = { id: 'model', title: '', description: '', position: [4, 0, -3.7], shape: 'cylinder', color: '#fff' };
  for (const aspect of [1.8, 0.6]) {
    const bounds = { center: [4, 2.24, -3.7] as [number, number, number], radius: 1.3 };
    const view = getExhibitView(display, bounds, aspect, 60)!;
    expect(view.target).toEqual([4, 2.24, -3.7]);
    const camera = new PerspectiveCamera(60, aspect, 0.1, 40);
    camera.position.fromArray(view.position); camera.lookAt(...view.target); camera.updateMatrixWorld(true);
    const distance = camera.position.distanceTo(new Vector3(...bounds.center));
    const halfFov = Math.min(Math.PI / 6, Math.atan(Math.tan(Math.PI / 6) * aspect));
    expect(distance * Math.sin(halfFov)).toBeGreaterThan(bounds.radius);
    expect(Math.abs(camera.position.x)).toBeLessThan(6.6);
    expect(Math.abs(camera.position.z)).toBeLessThan(7.6);
    expect(camera.position.y).toBeGreaterThan(0.4);
    expect(camera.position.y).toBeLessThan(4.6);
  }
});
