import { Canvas } from '@react-three/fiber/native';
import { configureExpoGlContext, type LoadedGlbAsset } from './glbLoader';

export interface GlbArtifactCanvasProps {
  asset: LoadedGlbAsset;
}

/**
 * Khung render R3F Native cho 1 hiện vật GLB đã chuẩn hóa (MOB-E6-02).
 * Đặt gốc mô hình theo `normalization.offset` và `normalization.scale` để đứng vững trên mặt bục y = 0.
 */
export function GlbArtifactCanvas({ asset }: GlbArtifactCanvasProps) {
  const { scale, offset, center } = asset.normalization;

  return (
    <Canvas
      camera={{ position: [0, center[1] + 0.6, 3.6], fov: 48 }}
      gl={{ antialias: true }}
      onCreated={(state) => {
        configureExpoGlContext(state.gl.getContext());
      }}
    >
      <color attach="background" args={['#111827']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 5]} intensity={1.35} />
      <directionalLight position={[-3, 2, -4]} intensity={0.4} color="#CCFBF1" />
      <group position={[0, -center[1], 0]}>
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[1.15, 1.2, 0.12, 32]} />
          <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.15} />
        </mesh>
        <group scale={[scale, scale, scale]}>
          <group position={offset}>
            <primitive object={asset.scene} />
          </group>
        </group>
      </group>
    </Canvas>
  );
}
