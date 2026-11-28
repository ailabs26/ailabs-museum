import { useMemo } from 'react';
import type { Object3D } from 'three';
import {
  ARTIFACT_BASE_Y,
  EXHIBIT_PLINTH_SIZE,
  MUSEUM_ROOM_SIZE,
  type ExhibitPlaceholderShape,
  type MuseumDisplay,
} from './museumTypes';
import {
  isDisplayOutsideRoom,
  resolveGalleryLayout,
  type GalleryLayoutResolution,
} from './gallerySlots';
import { GALLERY_PICK_TARGET } from './galleryPicking';
import { ArtifactHotspot3D } from './ArtifactHotspot3D';
import { getArtifactHotspots } from './artifactHotspots';
import type { HotspotStorySelection } from './hotspotStory';
import { QUALITY_PROFILES, type QualityProfile } from './performanceTier';
import type { RoomModelState } from './roomModelManager';

export type PedestalKind = 'hero' | 'standard' | 'square';

/**
 * Vỏ phòng trưng bày 14 x 16 x 5 m kèm ánh sáng Heritage Warm tối ưu theo tầng hiệu năng (MOB-E6-04, MOB-E6-08).
 */
export function MuseumRoomShell3D({
  quality = QUALITY_PROFILES.balanced,
}: {
  quality?: QualityProfile;
}) {
  const enableShadows = quality.enableShadows;
  return (
    <group name="museum-room-shell">
      <color attach="background" args={['#14181D']} />
      <ambientLight color="#f4f1e8" intensity={quality.enableSecondaryLights ? 0.45 : 0.65} />
      <hemisphereLight args={['#f6efe2', '#7d7362', 0.65]} />
      <directionalLight
        color="#ffe8cc"
        intensity={1.25}
        position={[-3.5, 4.8, 4]}
        castShadow={enableShadows}
      />
      {quality.enableSecondaryLights ? (
        <directionalLight color="#d6f0ea" intensity={0.35} position={[4.5, 3.8, -5]} />
      ) : null}

      {/* Mặt sàn y = 0 */}
      <mesh position={[0, -0.12, 0]} receiveShadow={enableShadows}>
        <boxGeometry args={[MUSEUM_ROOM_SIZE.width + 0.4, 0.24, MUSEUM_ROOM_SIZE.depth + 0.4]} />
        <meshStandardMaterial color="#252A30" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Hai tường trái/phải x = ±7 */}
      {[-1, 1].map((side) => (
        <mesh
          key={`wall-x-${side}`}
          position={[side * (MUSEUM_ROOM_SIZE.width / 2 + 0.12), MUSEUM_ROOM_SIZE.height / 2, 0]}
          receiveShadow={enableShadows}
        >
          <boxGeometry args={[0.24, MUSEUM_ROOM_SIZE.height, MUSEUM_ROOM_SIZE.depth + 0.4]} />
          <meshStandardMaterial color="#30363D" roughness={0.9} />
        </mesh>
      ))}

      {/* Hai tường trước/sau z = ±8 */}
      {[-1, 1].map((side) => (
        <mesh
          key={`wall-z-${side}`}
          position={[0, MUSEUM_ROOM_SIZE.height / 2, side * (MUSEUM_ROOM_SIZE.depth / 2 + 0.12)]}
          receiveShadow={enableShadows}
        >
          <boxGeometry args={[MUSEUM_ROOM_SIZE.width, MUSEUM_ROOM_SIZE.height, 0.24]} />
          <meshStandardMaterial color="#2A3038" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Bục trưng bày vật lý chuẩn `y = 1.14` (`ARTIFACT_BASE_Y`) giống web `GalleryPedestal.tsx`.
 */
export function GalleryPedestal3D({
  kind,
  isSelected = false,
  segments = 24,
}: {
  kind: PedestalKind;
  isSelected?: boolean;
  segments?: number;
}) {
  const isHero = kind === 'hero';
  const isRound = kind !== 'square';
  const footprint = isHero
    ? EXHIBIT_PLINTH_SIZE.centerpieceRadius
    : EXHIBIT_PLINTH_SIZE.roundRadius;

  return (
    <group>
      {/* Đế bục */}
      <mesh position={[0, 0.04, 0]}>
        {isRound ? (
          <cylinderGeometry args={[footprint, footprint, 0.08, segments]} />
        ) : (
          <boxGeometry
            args={[EXHIBIT_PLINTH_SIZE.squareWidth, 0.08, EXHIBIT_PLINTH_SIZE.squareWidth]}
          />
        )}
        <meshStandardMaterial color="#1F242A" roughness={0.8} />
      </mesh>

      {/* Thân bục */}
      <mesh position={[0, 0.58, 0]}>
        {isRound ? (
          <cylinderGeometry args={[isHero ? 1.1 : 0.66, isHero ? 1.16 : 0.7, 1.04, segments]} />
        ) : (
          <boxGeometry args={[1.05, 1.04, 1.05]} />
        )}
        <meshStandardMaterial color={isHero ? '#70685D' : '#524438'} roughness={0.72} />
      </mesh>

      {/* Mặt đồng đặt hiện vật ở y = 1.14 */}
      <mesh position={[0, 1.12, 0]}>
        {isRound ? (
          <cylinderGeometry args={[isHero ? 1.13 : 0.7, isHero ? 1.13 : 0.7, 0.04, segments]} />
        ) : (
          <boxGeometry args={[1.09, 0.04, 1.09]} />
        )}
        <meshStandardMaterial
          color={isSelected ? '#D4AF37' : '#8C7355'}
          roughness={0.45}
          metalness={0.35}
        />
      </mesh>

      {/* Vòng sáng đánh dấu khi bục đang được chọn */}
      {isSelected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} raycast={() => {}}>
          <ringGeometry args={[isHero ? 1.3 : 0.84, isHero ? 1.48 : 0.96, segments]} />
          <meshBasicMaterial color="#0D9488" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Hiện vật hình học dự phòng khi không có GLB hoặc khi mô hình đang tải / lỗi. */
export function ExhibitPlaceholder3D({
  shape,
  color,
  isSelected,
}: {
  shape: ExhibitPlaceholderShape;
  color: string;
  isSelected: boolean;
}) {
  return (
    <mesh position={[0, ARTIFACT_BASE_Y + 0.55, 0]}>
      {shape === 'sphere' ? (
        <sphereGeometry args={[0.42, 20, 16]} />
      ) : shape === 'torus' ? (
        <torusGeometry args={[0.42, 0.14, 14, 28]} />
      ) : shape === 'cone' ? (
        <coneGeometry args={[0.4, 0.85, 20]} />
      ) : shape === 'cylinder' ? (
        <cylinderGeometry args={[0.36, 0.36, 0.82, 20]} />
      ) : shape === 'icosahedron' ? (
        <icosahedronGeometry args={[0.44, 0]} />
      ) : (
        <boxGeometry args={[0.7, 0.7, 0.7]} />
      )}
      <meshStandardMaterial
        color={color}
        roughness={0.38}
        metalness={0.22}
        emissive={isSelected ? '#0F766E' : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : 0}
      />
    </mesh>
  );
}

function ClonedModelInstance({ scene }: { scene: Object3D }) {
  // Clone nhẹ phân cấp để cùng một GLB (chung checksum) có thể hiển thị trên nhiều bục khác nhau.
  const instance = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={instance} />;
}

/**
 * Hiển thị toàn bộ các bục và hiện vật trong phòng theo đúng bố cục `slotted` (S01..S05)
 * hoặc `legacy` (giữ nguyên tọa độ gốc).
 */
export function GalleryRoomDisplays3D({
  displays,
  modelStates,
  selectedExhibitId,
  activeHotspotSelection,
  quality = QUALITY_PROFILES.balanced,
}: {
  displays: readonly MuseumDisplay[];
  modelStates: ReadonlyMap<string, RoomModelState>;
  selectedExhibitId: string | null;
  activeHotspotSelection?: HotspotStorySelection | null;
  quality?: QualityProfile;
}) {
  const layout: GalleryLayoutResolution = useMemo(
    () => resolveGalleryLayout(displays),
    [displays],
  );

  const renderExhibitOnPedestal = (exhibit: MuseumDisplay) => {
    const state = modelStates.get(exhibit.id);
    const isSelected = exhibit.id === selectedExhibitId;
    const asset =
      state?.status === 'ready' && state.asset.checksumSha256 === exhibit.model?.checksumSha256
        ? state.asset
        : undefined;
    const normalization = asset?.normalization;
    const hotspots = (exhibit.isOutsideRoom ?? isDisplayOutsideRoom(exhibit))
      ? []
      : getArtifactHotspots(exhibit, normalization);
    return (
      <>
        {asset && normalization ? (
          <group position={[0, ARTIFACT_BASE_Y, 0]}>
            <group scale={[normalization.scale, normalization.scale, normalization.scale]}>
              <group position={normalization.offset}>
                <ClonedModelInstance scene={asset.scene} />
              </group>
            </group>
          </group>
        ) : (
          <ExhibitPlaceholder3D shape={exhibit.shape} color={exhibit.color} isSelected={isSelected} />
        )}
        {hotspots.map((hotspot) => (
          <ArtifactHotspot3D
            key={hotspot.id}
            hotspot={hotspot}
            active={
              isSelected &&
              (hotspot.isDefault ||
                (activeHotspotSelection?.exhibitId === exhibit.id &&
                  activeHotspotSelection.hotspotId === hotspot.id))
            }
          />
        ))}
      </>
    );
  };

  if (layout.mode === 'slotted') {
    return (
      <group name="gallery-slotted-layout">
        {layout.slots.map(({ slot, exhibit }) => (
          <group
            key={slot.id}
            name={`slot-${slot.id}`}
            position={[slot.position[0], slot.position[1], slot.position[2]]}
            userData={exhibit ? { [GALLERY_PICK_TARGET]: { exhibitId: exhibit.id } } : {}}
          >
            <GalleryPedestal3D
              kind={slot.plinthKind}
              isSelected={Boolean(exhibit && exhibit.id === selectedExhibitId)}
              segments={quality.geometrySegments}
            />
            {exhibit ? renderExhibitOnPedestal(exhibit) : null}
          </group>
        ))}
      </group>
    );
  }

  return (
    <group name="gallery-legacy-layout">
      {layout.displays.map((exhibit) => {
        const isCenterpiece = Boolean(exhibit.model) || exhibit.shape === 'torus';
        const kind: PedestalKind = isCenterpiece
          ? 'hero'
          : exhibit.shape === 'sphere' || exhibit.shape === 'cylinder'
            ? 'standard'
            : 'square';
        return (
          <group
            key={exhibit.id}
            name={`exhibit-${exhibit.id}`}
            position={exhibit.position}
            userData={{ [GALLERY_PICK_TARGET]: { exhibitId: exhibit.id } }}
          >
            <GalleryPedestal3D
              kind={kind}
              isSelected={exhibit.id === selectedExhibitId}
              segments={quality.geometrySegments}
            />
            {renderExhibitOnPedestal(exhibit)}
          </group>
        );
      })}
    </group>
  );
}
