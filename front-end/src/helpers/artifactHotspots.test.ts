import { expect, it } from 'vitest';
import { mapRoomDisplays } from './mapRoomDisplays';
import { getArtifactHotspots, getArtifactFocusBounds } from './artifactHotspots';
import { normalizeModel } from './modelNormalization';
import { BoxGeometry, Group, Mesh } from 'three';
import type { MuseumDisplay } from '@/interfaces/museumScene';

const display: MuseumDisplay = { id: 'artifact-a', title: 'Tên từ API', description: 'Mô tả thật',
  position: [3, 0, -2], shape: 'cube', color: '#ffffff', model: { id: 'model', checksumSha256: 'a'.repeat(64), sizeBytes: 100, storageKey: 'models/a.glb', url: '/model' } };

it('binds default hotspots to actual identity and current metadata with stable fallback bounds', () => {
  const [hotspot] = getArtifactHotspots(display);
  expect(hotspot).toMatchObject({ artifactId: display.id, label: display.title, body: display.description });
  expect(hotspot.position[1]).toBeGreaterThan(2.14);
  expect(getArtifactHotspots({ ...display, title: 'Tên mới' })[0]).toMatchObject({ id: hotspot.id, label: 'Tên mới' });
  expect(getArtifactFocusBounds(display)).toMatchObject({ center: [3, 1.64, -2] });
});

it('places defaults above normalized bounds independently of source pivot and scale', () => {
  const scene = new Group(); const mesh = new Mesh(new BoxGeometry(200, 400, 100));
  mesh.position.set(900, -100, -400); scene.add(mesh);
  const normalization = normalizeModel(scene);
  const [hotspot] = getArtifactHotspots(display, normalization);
  expect(hotspot.position[1]).toBeCloseTo(1.14 + normalization.size[1] + 0.22);
  expect(hotspot.position[0]).toBe(0);
});

it('uses source-local coordinates through the same pivot/scale transform and falls back safely without bounds', () => {
  const data = { ...display, hotspots: [{ id: 'detail', label: 'Hoa văn', body: 'Chi tiết', position: [10, 20, -10] as [number, number, number] }] };
  const normalization = { scale: 0.1, offset: [-10, -10, 10] as [number, number, number], size: [1, 2, 1] as [number, number, number], center: [0, 1, 0] as [number, number, number], radius: 1.3 };
  const [x, y, z] = getArtifactHotspots(data, normalization)[0].position;
  expect([x, z]).toEqual([0, 0]); expect(y).toBeCloseTo(2.14);
  expect(getArtifactHotspots(data)[0].position).not.toEqual([10, 20, -10]);
  expect(getArtifactHotspots({ ...data, position: [3, 1.5, -2] })[0].position[1] + 1.5).toBeLessThan(5);
});

it('keeps explicit primitive positions and generates distinct positions for unpositioned annotations', () => {
  expect(getArtifactHotspots({ ...display, model: null, hotspots: [{ id: 'x', label: 'X', body: '', position: [0.2, 2, 0.3] }] })[0].position).toEqual([0.2, 2, 0.3]);
  const points = getArtifactHotspots({ ...display, hotspots: [{ id: 'x', label: 'X', body: '' }, { id: 'y', label: 'Y', body: '' }] });
  expect(points[0].position).not.toEqual(points[1].position);
});

it('preserves API hotspot coordinates and order in the room mapper', () => {
  const result = mapRoomDisplays({ id: 'room', slug: 'test', name: 'Room', description: null, exhibits: [{
    id: 'item', roomId: 'room', name: 'Name', description: '', displayOrder: 1, transcript: null,
    placeholderShape: 'box', placeholderColor: '#ffffff', model: null, image: null, audio: null,
    hotspots: [{ id: 'h', label: 'Label', body: 'Body', displayOrder: 0, positionX: 1, positionY: 2, positionZ: 3 }],
  }] });
  expect(result[0].hotspots?.[0]).toMatchObject({ id: 'h', position: [1, 2, 3] });
});
