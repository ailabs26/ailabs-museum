import { useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { fitLabelTitle } from '@/helpers/fitLabelTitle';

/** Depth-tested billboard: walls and other exhibits occlude annotations naturally. */
export function ArtifactCaption({ title, subtitle, position, width = 1.6 }: {
  title: string; subtitle: string; position: [number, number, number]; width?: number;
}) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#faf5eb'; context.fillRect(0, 0, 512, 128);
      context.strokeStyle = '#25645c'; context.lineWidth = 8; context.strokeRect(0, 0, 512, 128);
      context.fillStyle = '#253a36'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.font = 'bold 28px sans-serif'; context.fillText(fitLabelTitle(title, text => context.measureText(text).width, 470), 256, 43);
      context.font = '23px sans-serif'; context.fillText(fitLabelTitle(subtitle, text => context.measureText(text).width, 470), 256, 91);
    }
    const next = new CanvasTexture(canvas); next.colorSpace = SRGBColorSpace; setTexture(next); invalidate();
    return () => next.dispose();
  }, [title, subtitle, invalidate]);
  return <sprite position={position} scale={[width, width / 4, 1]} raycast={() => {}}>
    <spriteMaterial map={texture} toneMapped={false} depthTest depthWrite={false} />
  </sprite>;
}
