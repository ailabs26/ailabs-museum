import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { ModelNormalization } from './modelNormalization';

export const ARTIFACT_BASE_Y = 1.14;
export const FALLBACK_MODEL_BOUNDS = { center: [0, 0.5, 0], size: [0.8, 1, 0.8], radius: Math.hypot(0.8, 1, 0.8) / 2 } as const;
export interface ArtifactHotspot {
  id: string; artifactId: string; label: string; body: string; position: [number, number, number];
}

export function getArtifactFocusBounds(display: MuseumDisplay, normalization?: ModelNormalization) {
  const bounds = normalization ?? FALLBACK_MODEL_BOUNDS;
  return { center: [display.position[0] + bounds.center[0], display.position[1] + ARTIFACT_BASE_Y + bounds.center[1], display.position[2] + bounds.center[2]] as [number, number, number], radius: bounds.radius };
}

/** Annotation transforms mirror ArtifactModel; defaults never depend on failed geometry. */
export function getArtifactHotspots(display: MuseumDisplay, normalization?: ModelNormalization): ArtifactHotspot[] {
  const annotations = display.hotspots?.length ? display.hotspots : [{ id: `${display.id}:default`, label: display.title, body: display.description }];
  const top = display.model ? ARTIFACT_BASE_Y + (normalization ?? FALLBACK_MODEL_BOUNDS).size[1] : display.shape === 'torus' ? 3.16 : 2.4;
  return annotations.map((annotation, index) => {
    let position: [number, number, number] | undefined;
    if (annotation.position) {
      if (!display.model) position = [...annotation.position];
      else if (normalization) position = annotation.position.map((value, axis) => (value + normalization.offset[axis]) * normalization.scale + (axis === 1 ? ARTIFACT_BASE_Y : 0)) as [number, number, number];
    }
    // Reject out-of-room annotations rather than projecting interactive controls through walls.
    if (!position || !position.every(Number.isFinite) || Math.abs(position[0] + display.position[0]) > MUSEUM_ROOM_SIZE.width / 2 - 0.2
      || Math.abs(position[2] + display.position[2]) > MUSEUM_ROOM_SIZE.depth / 2 - 0.2
      || position[1] + display.position[1] < 0.2 || position[1] + display.position[1] > MUSEUM_ROOM_SIZE.height - 0.2) {
      position = [(index - (annotations.length - 1) / 2) * Math.min(0.42, 1.2 / annotations.length),
        Math.min(top + 0.22, MUSEUM_ROOM_SIZE.height - display.position[1] - 0.2), 0];
    }
    return { id: annotation.id, artifactId: display.id, label: annotation.label || display.title, body: annotation.body, position };
  });
}
