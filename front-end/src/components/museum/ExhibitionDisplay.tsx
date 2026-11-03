import type { MuseumDisplay } from '@/interfaces/museumScene';
import { EXHIBIT_PLINTH_SIZE } from '@/interfaces/museumScene';
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { ExhibitLabel } from './ExhibitLabel';
import { ArtifactModel } from './ArtifactModel';
import type { ModelLoadState } from '@/helpers/roomModelAssets';
import { getArtifactHotspots } from '@/helpers/artifactHotspots';
import { ArtifactHotspot } from './ArtifactHotspot';
import { ArtifactFallback3D } from './ArtifactFallback3D';
import { ArtifactModelBoundary } from './ArtifactModelBoundary';
import { useGallerySurfaces } from './GallerySurfaces';
import { ExhibitPlaceholder } from './ExhibitPlaceholder';

export function ExhibitionDisplay({ display, isSelected, isXrHovered = false, onSelect, modelState, renderAttempt = 0, hasRenderError = false, onRenderError }: {
  isXrHovered?: boolean;
  display: MuseumDisplay; isSelected: boolean; onSelect: (id: string) => void; modelState?: ModelLoadState;
  renderAttempt?: number; hasRenderError?: boolean; onRenderError: () => void;
}) {
  const [isPointerHovered, setIsHovered] = useState(false);
  const { stone, walnut, bronze, charcoal, contact } = useGallerySurfaces();
  const isHovered = isPointerHovered || isXrHovered;
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    if (!isHovered) return;
    canvas.style.cursor = 'pointer';
    return () => { canvas.style.cursor = ''; };
  }, [canvas, isHovered]);
  const isCenterpiece = !!display.model || display.shape === 'torus';
  const isRoundPlinth = isCenterpiece || display.shape === 'sphere' || display.shape === 'cylinder';
  return (
    <group position={display.position} userData={{ artifactId: display.id }}
      onPointerOver={(event) => { event.stopPropagation(); setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(display.id); }}>
      {/* Edge-transparent soft contact occlusion is also retained in the low tier. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]} raycast={() => {}} userData={{ xrIgnore: true }}>
        <planeGeometry args={[isCenterpiece ? 3.5 : 2.4, isCenterpiece ? 3.5 : 2.4]} />
        <meshBasicMaterial map={contact} transparent opacity={.65} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
        <ringGeometry args={[isCenterpiece ? 1.3 : 0.84, isCenterpiece ? 1.5 : 0.95, 32]} />
        <meshBasicMaterial color={isSelected ? '#b89b5e' : '#b69761'} transparent opacity={isSelected ? .65 : isHovered ? .4 : 0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, 0]} material={charcoal} receiveShadow>
        {isRoundPlinth ? <cylinderGeometry args={[isCenterpiece ? EXHIBIT_PLINTH_SIZE.centerpieceRadius : EXHIBIT_PLINTH_SIZE.roundRadius, isCenterpiece ? EXHIBIT_PLINTH_SIZE.centerpieceRadius : EXHIBIT_PLINTH_SIZE.roundRadius, 0.08, 32]} /> : <boxGeometry args={[EXHIBIT_PLINTH_SIZE.squareWidth, 0.08, EXHIBIT_PLINTH_SIZE.squareWidth]} />}
      </mesh>
      <mesh position={[0, 0.58, 0]} material={isCenterpiece ? stone : walnut} castShadow receiveShadow>
        {isRoundPlinth ? <cylinderGeometry args={[isCenterpiece ? 1.1 : 0.66, isCenterpiece ? 1.16 : 0.7, 1.04, 32]} /> : <boxGeometry args={[1.05, 1.04, 1.05]} />}
      </mesh>
      <mesh position={[0, 1.12, 0]} material={bronze} castShadow receiveShadow>
        {isRoundPlinth ? <cylinderGeometry args={[isCenterpiece ? 1.13 : 0.7, isCenterpiece ? 1.13 : 0.7, 0.04, 32]} /> : <boxGeometry args={[1.09, 0.04, 1.09]} />}
      </mesh>
      {display.model ? modelState?.status === 'ready' ?
        <ArtifactModelBoundary key={`${display.model.checksumSha256}:${renderAttempt}`} onError={onRenderError} fallback={<ArtifactFallback3D artifactId={display.id} />}>
          <ArtifactModel asset={modelState.asset} artifactId={display.id} />
        </ArtifactModelBoundary> :
        <ArtifactFallback3D artifactId={display.id} isLoading={modelState?.status !== 'error'} />
        : <ExhibitPlaceholder shape={display.shape} color={display.color} isSelected={isSelected} isHovered={isHovered} />}
      <ExhibitLabel title={display.title} isSelected={isSelected} isCenterpiece={isCenterpiece} />
      {getArtifactHotspots(display, !hasRenderError && modelState?.status === 'ready' ? modelState.asset.normalization : undefined).map(hotspot =>
        <ArtifactHotspot key={hotspot.id} hotspot={hotspot} artifactTitle={display.title} isSelected={isSelected} isXrHovered={isXrHovered} onSelect={onSelect} />)}
    </group>
  );
}
