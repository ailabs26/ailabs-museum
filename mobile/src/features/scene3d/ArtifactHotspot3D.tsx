import { palette } from '@/theme/tokens';
import type { ArtifactHotspot } from './artifactHotspots';

/** Marker nhẹ trong hệ tọa độ cục bộ của bục. Bề mặt hiển thị cũng là vùng chạm. */
export function ArtifactHotspot3D({
  hotspot,
  active,
}: {
  hotspot: ArtifactHotspot;
  active: boolean;
}) {
  return (
    <mesh name="artifact-hotspot" position={hotspot.position} scale={active ? 1.2 : 1}>
      <sphereGeometry args={[0.16, 12, 8]} />
      <meshBasicMaterial color={active ? palette.teal600 : '#F7F3EA'} />
    </mesh>
  );
}
