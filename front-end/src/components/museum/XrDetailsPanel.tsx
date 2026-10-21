import { useLayoutEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Group, Matrix4, SRGBColorSpace } from 'three';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { placeXrPanel } from '@/helpers/xrInteraction';

/** Essential headset UI is a real scene object; ordinary DOM is not visible in VR. */
export function XrDetailsPanel({ display, page, onPageCount }: { display?: MuseumDisplay; page: number; onPageCount: (count: number) => void }) {
  const { gl, invalidate } = useThree();
  const panel = useRef<Group>(null);
  const needsPlacement = useRef(true);
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useLayoutEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.font = '30px sans-serif';
    const copy = display ? [display.title, display.description || 'Chưa có mô tả.', display.transcript,
      ...display.hotspots?.map(hotspot => `${hotspot.label}: ${hotspot.body}`) ?? []].filter(Boolean).join('\n\n')
      : 'Tham quan VR\n\nNgắm điểm tương tác và bóp cò để chọn hiện vật. Ngắm sàn trống và bóp cò để dịch chuyển (tối đa 8 m, đường thẳng không bị bệ chắn). Cần điều khiển bên phải: xoay từng bước 30°.\n\nKhông có controller: nhìn giữ 1,5 giây để chọn hoặc dùng thao tác chọn của thiết bị. Nhìn giữ không tự dịch chuyển.';
    const lines: string[] = [];
    for (const paragraph of copy.split('\n')) {
      let line = '';
      // Character wrapping preserves even unbroken/very long published text.
      for (const character of Array.from(paragraph)) {
        if (context.measureText(line + character).width > 920 && line) { lines.push(line); line = ''; }
        line += character;
      }
      lines.push(line);
    }
    const count = Math.max(1, Math.ceil(lines.length / 16)); onPageCount(count);
    context.fillStyle = '#faf5eb'; context.fillRect(0, 0, 1024, 768);
    context.strokeStyle = '#25645c'; context.lineWidth = 10; context.strokeRect(0, 0, 1024, 768);
    context.fillStyle = '#253a36'; context.textBaseline = 'top';
    const current = Math.min(page, count - 1);
    lines.slice(current * 16, (current + 1) * 16).forEach((line, index) => context.fillText(line, 52, 35 + index * 37));
    context.font = 'bold 30px sans-serif'; context.fillText('‹ Trước', 60, 680); context.fillText(`${current + 1}/${count}`, 360, 680);
    context.fillText('Sau ›', 500, 680); context.fillText('Exit VR', 800, 680);
    const next = new CanvasTexture(canvas); next.colorSpace = SRGBColorSpace; setTexture(next); invalidate();
    return () => next.dispose();
  }, [display, page, invalidate, onPageCount]);
  useLayoutEffect(() => { needsPlacement.current = true; }, [display?.id]);
  useFrame((_, __, frame) => {
    const space = gl.xr.getReferenceSpace();
    if (!panel.current || !needsPlacement.current || !frame || !space) return;
    const pose = frame.getViewerPose(space); if (!pose) return;
    placeXrPanel(panel.current, new Matrix4().fromArray(pose.transform.matrix)); invalidate();
    needsPlacement.current = false;
  });
  return <group ref={panel} name="xr-details">
    <mesh userData={{ museumLabel: true }} renderOrder={20}>
      <planeGeometry args={[1.6, 1.2]} /><meshBasicMaterial map={texture} toneMapped={false} depthTest={false} depthWrite={false} />
    </mesh>
    {[{ action: 'previous', x: -0.53, width: 0.42 }, { action: 'next', x: 0.07, width: 0.38 }, { action: 'exit', x: 0.58, width: 0.34 }].map(button =>
      <mesh key={button.action} position={[button.x, -0.49, 0.01]} userData={{ xrAction: button.action, museumLabel: true }}>
        <planeGeometry args={[button.width, 0.17]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>)}
  </group>;
}
