import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group, PerspectiveCamera } from 'three';
import { projectedModelPixels, selectModelLod } from '@/helpers/modelLod';
import type { ModelLodLevel, ModelLodSet } from '@/helpers/modelLod';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { LoadedModel, ModelLoadState } from '@/helpers/roomModelAssets';
import { ARTIFACT_BASE_Y, getArtifactHotspots } from '@/helpers/artifactHotspots';
import { ArtifactFallback3D } from './ArtifactFallback3D';
import { ArtifactHotspot } from './ArtifactHotspot';
import { ArtifactModel } from './ArtifactModel';
import { ArtifactModelBoundary } from './ArtifactModelBoundary';
import { ExhibitLabel } from './ExhibitLabel';
import { ExhibitPlaceholder } from './ExhibitPlaceholder';
import { GalleryPedestal, type PedestalKind } from './GalleryPedestal';

export interface ExhibitRenderProps {
  isSelected: boolean; isXrHovered?: boolean; onSelect: (id: string) => void; modelState?: ModelLoadState;
  renderAttempt?: number; hasRenderError?: boolean; onRenderError: () => void;
  lodSet?: ModelLodSet; isFocused?: boolean; onLodChange?: (checksum: string, level: ModelLodLevel, consumerId: string) => void;
  onRetainModel?: (asset: LoadedModel) => (() => void) | undefined;
}

/** Nội dung hiện vật trên bục: chỉ mount khi vị trí này có hiện vật. Model lỗi/đang tải vẫn giữ bục. */
function ExhibitContent({ display, isCenterpiece, isHovered, isSelected, isXrHovered = false, onSelect, modelState, renderAttempt = 0, hasRenderError = false, onRenderError, onRetainModel }:
  ExhibitRenderProps & { display: MuseumDisplay; isCenterpiece: boolean; isHovered: boolean }) {
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
      <ringGeometry args={[isCenterpiece ? 1.3 : 0.84, isCenterpiece ? 1.5 : 0.95, 32]} />
      <meshBasicMaterial color={isSelected ? '#b89b5e' : '#b69761'} transparent opacity={isSelected ? .65 : isHovered ? .4 : 0} depthWrite={false} />
    </mesh>
    {display.model ? modelState?.status === 'ready' ?
      <ArtifactModelBoundary key={`${display.model.checksumSha256}:${renderAttempt}`} onError={onRenderError} fallback={<ArtifactFallback3D artifactId={display.id} />}>
        <ArtifactModel asset={modelState.asset} artifactId={display.id} onRetain={onRetainModel} />
      </ArtifactModelBoundary> :
      <ArtifactFallback3D artifactId={display.id} isLoading={modelState?.status !== 'error'} />
      : <ExhibitPlaceholder shape={display.shape} color={display.color} isSelected={isSelected} isHovered={isHovered} />}
    <ExhibitLabel title={display.title} isSelected={isSelected} isCenterpiece={isCenterpiece} />
    {getArtifactHotspots(display, !hasRenderError && modelState?.status === 'ready' ? modelState.asset.normalization : undefined).map(hotspot =>
      <ArtifactHotspot key={hotspot.id} hotspot={hotspot} artifactTitle={display.title} isSelected={isSelected} isXrHovered={isXrHovered} onSelect={onSelect} />)}
  </>;
}

/**
 * Một vị trí trưng bày: bục luôn có; hiện vật (nếu có) mới nhận hover/chọn theo exhibit id.
 * Bục trống vẫn chắn tia chọn để không bấm xuyên qua bục vào hiện vật phía sau, nhưng không mở chi tiết nào.
 */
export function GallerySlotView({ position, pedestal, exhibit, slotId, hasTrim, ...content }: ExhibitRenderProps & {
  position: readonly [number, number, number]; pedestal: PedestalKind; exhibit: MuseumDisplay | null; slotId?: string; hasTrim?: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const lodLevel = useRef<ModelLodLevel>();
  const worldCenter = useRef(new Vector3());
  useEffect(() => { lodLevel.current = undefined; }, [exhibit?.id, exhibit?.model?.checksumSha256]);
  useFrame(({ camera, gl, size }) => {
    if (!content.lodSet || !exhibit?.model || !groupRef.current) return;
    const { center, radius } = content.lodSet.normalization;
    groupRef.current.localToWorld(worldCenter.current.set(center[0], center[1] + ARTIFACT_BASE_Y, center[2]));
    const perspective = camera as PerspectiveCamera;
    // Native XR cameras have per-eye projections. Full detail protects inspection there.
    const pixels = perspective.isPerspectiveCamera ? projectedModelPixels(radius, camera.position.distanceTo(worldCenter.current),
      perspective.getEffectiveFOV(), size.height, gl.getPixelRatio()) : Infinity;
    const level = selectModelLod(pixels, lodLevel.current ?? 2, content.isSelected || !!content.isFocused || gl.xr.isPresenting, content.lodSet.thresholds);
    lodLevel.current = level;
    // The room owner deduplicates demand, including after owner replacement or a reused slot.
    content.onLodChange?.(exhibit.model.checksumSha256, level, exhibit.id);
  });
  const [isPointerHovered, setIsHovered] = useState(false);
  const isHovered = !!exhibit && (isPointerHovered || !!content.isXrHovered);
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    if (!isHovered) return;
    canvas.style.cursor = 'pointer';
    return () => { canvas.style.cursor = ''; };
  }, [canvas, isHovered]);
  const exhibitId = exhibit?.id;
  useEffect(() => { if (!exhibitId) setIsHovered(false); }, [exhibitId]);
  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]} userData={exhibit ? { artifactId: exhibit.id, gallerySlot: slotId } : { gallerySlot: slotId }}
      onPointerOver={(event) => { event.stopPropagation(); if (exhibit) setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); if (exhibit) content.onSelect(exhibit.id); }}>
      <GalleryPedestal kind={pedestal} hasTrim={hasTrim} />
      {exhibit && <ExhibitContent display={exhibit} isCenterpiece={pedestal === 'hero'} isHovered={isHovered} {...content} />}
    </group>
  );
}
