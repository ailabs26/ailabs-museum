import { ARTIFACT_BASE_Y } from '@/helpers/artifactHotspots';
import { ArtifactCaption } from './ArtifactCaption';

/** Uses only owned declarative resources, anchored on the existing exhibit pedestal. */
export function ArtifactFallback3D({ artifactId, isLoading = false }: { artifactId: string; isLoading?: boolean }) {
  const color = isLoading ? '#85745b' : '#a45b28';
  return <group position={[0, ARTIFACT_BASE_Y, 0]} userData={{ artifactId, artifactFallback: true, isLoading }}>
    <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.34, 0.035, 8, 24]} /><meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.5, 0]}>
      <octahedronGeometry args={[0.38, 0]} /><meshStandardMaterial color="#d1c7b4" roughness={0.8} metalness={0.1} />
    </mesh>
    <mesh position={[0, 0.5, 0]}>
      <octahedronGeometry args={[0.4, 0]} /><meshBasicMaterial color={color} wireframe />
    </mesh>
    <ArtifactCaption title={isLoading ? 'Đang tải mô hình 3D' : 'Mô hình 3D không khả dụng'} subtitle="Chọn để đọc thông tin hiện vật" position={[0, 1, 0]} width={1.5} />
  </group>;
}
