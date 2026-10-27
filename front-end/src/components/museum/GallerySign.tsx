import { useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';

/** Architectural identity, not an invented cultural artifact or room-specific content. */
export function GallerySign() {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.textAlign = 'center'; context.fillStyle = '#d9c396';
    context.font = '116px Georgia, serif'; context.fillText('A U R A', 512, 218);
    context.fillRect(445, 264, 134, 2);
    context.font = '21px sans-serif'; context.fillText('BẢO TÀNG SỐ · DI SẢN VIỆT NAM', 512, 328);
    context.font = '16px sans-serif'; context.fillStyle = '#bcb8a8'; context.fillText('KẾT NỐI QUÁ KHỨ — KHƠI MỞ TƯƠNG LAI', 512, 382);
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; setTexture(map); invalidate();
    return () => map.dispose();
  }, [invalidate]);
  return <mesh position={[0, 2.7, -7.87]}>
    <planeGeometry args={[5.2, 2.6]} /><meshBasicMaterial map={texture} transparent opacity={texture ? 1 : 0} toneMapped={false} depthWrite={false} />
  </mesh>;
}
