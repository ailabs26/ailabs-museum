import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { ModelNormalization } from './modelNormalization';

export const ARTIFACT_BASE_Y = 1.14;
export const FALLBACK_MODEL_BOUNDS = { center: [0, 0.5, 0], size: [0.8, 1, 0.8], radius: Math.hypot(0.8, 1, 0.8) / 2 } as const;
export interface ArtifactHotspot {
  id: string; artifactId: string; label: string; body: string; position: [number, number, number]; isDefault: boolean;
}

export function getArtifactFocusBounds(display: MuseumDisplay, normalization?: ModelNormalization) {
  const bounds = normalization ?? FALLBACK_MODEL_BOUNDS;
  return { center: [display.position[0] + bounds.center[0], display.position[1] + ARTIFACT_BASE_Y + bounds.center[1], display.position[2] + bounds.center[2]] as [number, number, number], radius: bounds.radius };
}

function getAuthoredPosition(display: MuseumDisplay, source?: ArtifactHotspot['position'], normalization?: ModelNormalization): ArtifactHotspot['position'] | null {
  if (!source || (display.model && !normalization)) return null;
  const position = normalization && display.model
    ? source.map((value, axis) => (value + normalization.offset[axis]) * normalization.scale + (axis === 1 ? ARTIFACT_BASE_Y : 0)) as ArtifactHotspot['position']
    : [...source] as ArtifactHotspot['position'];
  const [x, y, z] = position.map((value, axis) => value + display.position[axis]);
  if (![x, y, z].every(Number.isFinite) || Math.abs(x) > MUSEUM_ROOM_SIZE.width / 2 - 0.2
    || Math.abs(z) > MUSEUM_ROOM_SIZE.depth / 2 - 0.2 || y < 0.2 || y > MUSEUM_ROOM_SIZE.height - 0.2) return null;
  return position;
}

/** Gallery groups translate the normalized point by the resolved display position. */
export function getHotspotWorldTarget(display: MuseumDisplay, hotspotId: string, normalization?: ModelNormalization): ArtifactHotspot['position'] | null {
  if (display.isOutsideRoom) return null;
  const position = getAuthoredPosition(display, display.hotspots?.find(hotspot => hotspot.id === hotspotId)?.position, normalization);
  return position && [position[0] + display.position[0], position[1] + display.position[1], position[2] + display.position[2]];
}

/** Annotation transforms mirror ArtifactModel; defaults never depend on failed geometry. */
export function getArtifactHotspots(display: MuseumDisplay, normalization?: ModelNormalization): ArtifactHotspot[] {
  const stories = display.hotspots?.length ? display.hotspots : undefined;
  const annotations = stories ?? [{ id: `${display.id}:default`, label: display.title, body: display.description }];
  const top = display.model ? ARTIFACT_BASE_Y + (normalization ?? FALLBACK_MODEL_BOUNDS).size[1] : display.shape === 'torus' ? 3.16 : 2.4;
  return annotations.map((annotation, index) => {
    const position = getAuthoredPosition(display, annotation.position, normalization)
      ?? [(index - (annotations.length - 1) / 2) * Math.min(0.42, 1.2 / annotations.length),
        Math.min(top + 0.22, MUSEUM_ROOM_SIZE.height - display.position[1] - 0.2), 0];
    return { id: annotation.id, artifactId: display.id, label: annotation.label || display.title, body: annotation.body, position, isDefault: !stories };
  });
}
