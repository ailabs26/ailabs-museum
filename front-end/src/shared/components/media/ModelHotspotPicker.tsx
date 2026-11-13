import { useRef, useState } from 'react';
import { Slider, Stack, Text } from '@mantine/core';
import { Canvas } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import { PreviewStatus } from './ModelPreview';
import { usePreviewModel } from './previewModel';

export type HotspotPoint = [number, number, number];

export interface ModelHotspotPickerProps {
  url: string;
  /** Hotspot hiện có, theo tọa độ local của GLB gốc. */
  points: HotspotPoint[];
  /** Hotspot đang được đặt vị trí (tô đỏ); `null` = chưa chọn hotspot nào. */
  activeIndex: number | null;
  onPick: (point: HotspotPoint) => void;
  height?: number;
}

/** Bán kính marker trên màn hình (mét sau chuẩn hóa) — không phụ thuộc kích thước thật của model. */
const MARKER_RADIUS = 0.035;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Bấm lên mô hình để lấy tọa độ hotspot. Điểm trả về nằm trong hệ local của GLB gốc — cùng hệ
 * tour dùng khi đặt hotspot: vị trí hiển thị = (điểm + offset) × scale (xem `getArtifactHotspots`).
 */
export default function ModelHotspotPicker({ url, points, activeIndex, onPick, height = 320 }: ModelHotspotPickerProps) {
  const state = usePreviewModel(url);
  const [angle, setAngle] = useState(0);
  const sourceSpace = useRef<Group>(null);

  if (state.status !== 'ready') return <PreviewStatus state={state} height={height} />;

  const { scale, offset, size } = state.model.normalization;
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    // Chỉ lấy giao điểm gần camera nhất; bỏ qua cú click kết thúc một thao tác kéo.
    event.stopPropagation();
    if (activeIndex === null || !sourceSpace.current || event.delta > 4) return;
    const local = sourceSpace.current.worldToLocal(event.point.clone());
    onPick([round(local.x), round(local.y), round(local.z)]);
  };

  return (
    <Stack gap={6}>
      <div
        style={{
          height,
          borderRadius: 4,
          overflow: 'hidden',
          background: '#e9ecef',
          cursor: activeIndex === null ? 'default' : 'crosshair',
        }}
      >
        <Canvas
          camera={{ position: [0, size[1] * 0.7, 3.4], fov: 40 }}
          onCreated={({ camera }) => camera.lookAt(0, size[1] / 2, 0)}
          aria-label="Mô hình 3D để đặt vị trí hotspot"
          role="img"
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} />
          <directionalLight position={[-4, 2, -3]} intensity={0.5} />
          <group rotation={[0, (angle * Math.PI) / 180, 0]}>
            <group scale={scale}>
              <group ref={sourceSpace} position={offset}>
                <primitive object={state.model.scene} onClick={handleClick} />
                {points.map((point, index) => (
                  <mesh key={index} position={point} raycast={() => null} renderOrder={10}>
                    <sphereGeometry args={[MARKER_RADIUS / scale, 16, 12]} />
                    <meshBasicMaterial color={index === activeIndex ? '#e03131' : '#f08c00'} depthTest={false} />
                  </mesh>
                ))}
              </group>
            </group>
          </group>
        </Canvas>
      </div>
      <Slider
        label={(value) => `${value}°`}
        min={0}
        max={360}
        step={5}
        value={angle}
        onChange={setAngle}
        aria-label="Xoay mô hình"
      />
      <Text size="xs" c="dimmed">
        {activeIndex === null
          ? 'Bấm "Chọn trên mô hình" ở một hotspot rồi bấm lên bề mặt mô hình để đặt vị trí. Kéo thanh trượt để xoay.'
          : `Bấm lên bề mặt mô hình để đặt vị trí hotspot #${activeIndex + 1}. Kéo thanh trượt để xoay mặt khác.`}
      </Text>
    </Stack>
  );
}
