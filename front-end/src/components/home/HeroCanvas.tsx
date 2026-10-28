import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending, Color, type Group, MathUtils, type Points as ThreePoints,
} from 'three';

/**
 * Nền 3D sống động cho hero trang chủ (Aura DS 2.0).
 *
 * Trường hạt ánh sáng + khối di sản đa diện xoay nhẹ, dịch chuyển thị sai (parallax)
 * theo con trỏ — gợi không gian trưng bày số mà không phủ nội dung chữ.
 * Thuần trang trí: bọc trong phần tử `aria-hidden`, có fallback 2D ở HomePage khi
 * thiết bị không hỗ trợ WebGL, và đóng băng chuyển động khi `reducedMotion`.
 */

const PARTICLE_COUNT = 620;

/** Tông màu Aura cho hạt sáng (emerald / teal / cyan / gold). */
const PARTICLE_COLORS = ['#10b981', '#2dd4bf', '#06b6d4', '#f59e0b'];

function ParticleField({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<ThreePoints>(null);

  // Toạ độ + màu cố định cho vòng đời component — tránh dựng lại buffer mỗi khung hình.
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const palette = PARTICLE_COLORS.map((hex) => new Color(hex));
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      // Phân bố trong vỏ cầu để tạo chiều sâu, dày hơn ở rìa.
      const radius = MathUtils.lerp(2.6, 7.2, Math.cbrt(Math.random()));
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = radius * Math.cos(phi);
      const tint = palette[i % palette.length];
      col[i * 3] = tint.r;
      col[i * 3 + 1] = tint.g;
      col[i * 3 + 2] = tint.b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return;
    ref.current.rotation.y += delta * 0.04;
    ref.current.rotation.x += delta * 0.012;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/** Khối di sản đa diện — "hiện vật" trừu tượng phát sáng nhẹ ở trung tâm. */
function HeritageCore({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<Group>(null);

  useFrame((state, delta) => {
    const group = ref.current;
    if (!group) return;
    if (!reducedMotion) {
      group.rotation.y += delta * 0.18;
      group.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.12;
    }
  });

  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[1.35, 0]} />
        <meshStandardMaterial
          color="#0d9488"
          emissive="#10b981"
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.6}
          flatShading
        />
      </mesh>
      {/* Lồng wireframe ngoài gợi lưới quét 3D. */}
      <mesh scale={1.55}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color="#2dd4bf" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

/** Dịch chuyển thị sai toàn cảnh theo con trỏ, mượt bằng nội suy tuyến tính. */
function ParallaxRig({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  const ref = useRef<Group>(null);
  const { pointer } = useThree();

  useFrame(() => {
    const group = ref.current;
    if (!group || reducedMotion) return;
    group.rotation.y = MathUtils.lerp(group.rotation.y, pointer.x * 0.35, 0.05);
    group.rotation.x = MathUtils.lerp(group.rotation.x, -pointer.y * 0.25, 0.05);
  });

  return <group ref={ref}>{children}</group>;
}

export default function HeroCanvas({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 5, 6]} intensity={1.1} color="#ffffff" />
      <pointLight position={[-5, -2, -3]} intensity={0.8} color="#06b6d4" />
      <pointLight position={[3, -4, 2]} intensity={0.5} color="#f59e0b" />
      <ParallaxRig reducedMotion={reducedMotion}>
        <HeritageCore reducedMotion={reducedMotion} />
        <ParticleField reducedMotion={reducedMotion} />
      </ParallaxRig>
    </Canvas>
  );
}
