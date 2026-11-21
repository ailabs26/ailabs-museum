import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import type { Mesh } from 'three';
import { FpsMeter, type FpsSnapshot } from './fpsMeter';

export const SPIKE_CUBE_COLORS = ['#0F766E', '#D97706', '#2563EB'] as const;

export interface SpinningCubeSceneProps {
  /** Tạm dừng xoay (do người dùng chọn hoặc app vào nền). */
  paused: boolean;
  /** Tôn trọng cài đặt Giảm chuyển động của OS (MOB-E11-04). */
  reducedMotion: boolean;
  /** Chỉ số màu hiện tại trong `SPIKE_CUBE_COLORS`. */
  colorIndex: number;
  /** Bộ đếm để đưa góc xoay cube về (0, 0, 0) và reset bộ đo FPS. */
  resetNonce: number;
  /** Callback cập nhật thông số FPS định kỳ (500ms) để không kéo tụt frame rate. */
  onFpsSample?: (snapshot: FpsSnapshot) => void;
  /** Callback khi người dùng chạm vào khối lập phương. */
  onCubePress?: () => void;
}

const REPORT_INTERVAL_MS = 500;
const ROTATION_SPEED_RAD_PER_SEC = 1.1;

function RotatingCube({
  paused,
  reducedMotion,
  color,
  resetNonce,
  onFpsSample,
  onCubePress,
}: {
  paused: boolean;
  reducedMotion: boolean;
  color: string;
  resetNonce: number;
  onFpsSample?: (snapshot: FpsSnapshot) => void;
  onCubePress?: () => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const meterRef = useRef<FpsMeter>(new FpsMeter({ windowSize: 120, maxGapMs: 500 }));
  const accumulatedMsRef = useRef(0);

  useEffect(() => {
    meterRef.current.reset();
    accumulatedMsRef.current = 0;
    if (meshRef.current) {
      meshRef.current.rotation.set(0.35, 0.55, 0);
    }
    onFpsSample?.(meterRef.current.getSnapshot());
  }, [resetNonce, onFpsSample]);

  useFrame((_state, deltaSeconds) => {
    const deltaMs = deltaSeconds * 1000;
    meterRef.current.recordDelta(deltaMs);
    accumulatedMsRef.current += deltaMs;

    if (accumulatedMsRef.current >= REPORT_INTERVAL_MS) {
      accumulatedMsRef.current = 0;
      onFpsSample?.(meterRef.current.getSnapshot());
    }

    if (!paused && !reducedMotion && meshRef.current) {
      // Kẹp delta để tránh nhảy góc lớn sau khi app trở lại từ nền.
      const clampedDelta = Math.min(deltaSeconds, 0.05);
      meshRef.current.rotation.x += ROTATION_SPEED_RAD_PER_SEC * 0.65 * clampedDelta;
      meshRef.current.rotation.y += ROTATION_SPEED_RAD_PER_SEC * clampedDelta;
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[0.35, 0.55, 0]}
      onClick={() => onCubePress?.()}
    >
      <boxGeometry args={[1.6, 1.6, 1.6]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
    </mesh>
  );
}

/**
 * Khung cảnh 3D tối thiểu bằng `@react-three/fiber/native` + `expo-gl` (MOB-E6-01).
 * Phiên bản pin tương thích Expo SDK 52 (`three@0.166.1`, `@react-three/fiber@8.17.10`, `expo-gl@~15.0.5`).
 */
export function SpinningCubeScene({
  paused,
  reducedMotion,
  colorIndex,
  resetNonce,
  onFpsSample,
  onCubePress,
}: SpinningCubeSceneProps) {
  const safeIndex = Math.abs(colorIndex) % SPIKE_CUBE_COLORS.length;
  const color = SPIKE_CUBE_COLORS[safeIndex] ?? SPIKE_CUBE_COLORS[0];

  return (
    <Canvas
      camera={{ position: [0, 0.4, 4.2], fov: 50 }}
      gl={{ antialias: true }}
      onCreated={(state) => {
        // Bỏ qua cảnh báo pixelStorei UNPACK_FLIP_Y_WEBGL trên một số driver Expo GL.
        const glContext = state.gl.getContext() as { pixelStorei?: (...args: unknown[]) => void } | null;
        if (glContext && typeof glContext.pixelStorei === 'function') {
          const origPixelStorei = glContext.pixelStorei.bind(glContext);
          glContext.pixelStorei = (...args: unknown[]) => {
            const [parameter] = args;
            if (parameter === 0x9240 /* UNPACK_FLIP_Y_WEBGL */) return;
            origPixelStorei(...args);
          };
        }
      }}
    >
      <color attach="background" args={['#111827']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 5]} intensity={1.35} />
      <directionalLight position={[-4, -2, -3]} intensity={0.45} color="#CCFBF1" />
      <RotatingCube
        paused={paused}
        reducedMotion={reducedMotion}
        color={color}
        resetNonce={resetNonce}
        onFpsSample={onFpsSample}
        onCubePress={onCubePress}
      />
    </Canvas>
  );
}
