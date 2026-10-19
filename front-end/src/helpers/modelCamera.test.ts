import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { getExhibitView } from './museumCamera';
import { constrainCameraToRoom } from './museumCamera';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

it('wall-constrained model orbit preserves distance and stops emitting change events', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(3.6, 2.5, 0);
  const listeners = { addEventListener() {}, removeEventListener() {} };
  const element = { ...listeners, style: {}, getRootNode: () => listeners } as unknown as HTMLElement;
  const controls = new OrbitControls(camera, element);
  controls.target.set(5.4, 2.24, 0);
  controls.minDistance = 1.8;
  controls.minPolarAngle = 1.25; controls.maxPolarAngle = 1.55;
  controls.update();
  const lastSafe = camera.position.clone();
  let changes = 0;
  controls.addEventListener('change', () => {
    constrainCameraToRoom(camera.position, lastSafe);
    camera.lookAt(controls.target); changes++;
  });
  camera.position.set(8, 2.6, 0);
  for (let step = 0; step < 1000; step++) controls.update();
  expect(camera.position.x).toBeLessThan(6.6);
  expect(camera.position.distanceTo(controls.target)).toBeGreaterThanOrEqual(1.8);
  expect(changes).toBeLessThan(5);
  controls.dispose();
});
