import { useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { EXHIBIT_LABEL_SIZE } from '@/interfaces/museumScene';
import { fitLabelTitle } from '@/helpers/fitLabelTitle';

/** System-font plaque: no font download, DOM overlay or external texture. */
export function ExhibitLabel({ title, isSelected, isCenterpiece }: { title: string; isSelected: boolean; isCenterpiece: boolean }) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  // Allocate only for a committed mount; StrictMode cleanup owns this instance.
  useLayoutEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const label = new CanvasTexture(canvas);
    label.colorSpace = SRGBColorSpace;
    setTexture(label);
    return () => label.dispose();
  }, []);
  useLayoutEffect(() => {
    if (!texture) return;
    const canvas = texture.image as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#faf5eb';
      context.fillRect(0, 0, 512, 128);
      context.fillStyle = isSelected ? '#25645c' : '#b29463';
      context.fillRect(0, 0, 8, 128);
      context.fillStyle = '#253a36';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '30px "Times New Roman", serif';
      const line = fitLabelTitle(title, (text) => context.measureText(text).width, 450);
      context.fillText(line, 260, 52);
      context.font = '18px sans-serif';
      context.fillStyle = '#5e6258';
      context.fillText(isSelected ? 'ĐANG XEM' : 'CHỌN ĐỂ KHÁM PHÁ', 260, 92);
    }
    texture.needsUpdate = true;
    invalidate();
  }, [texture, title, isSelected, invalidate]);
  return <sprite renderOrder={1} userData={{ museumLabel: true }} position={[0, 0.78, isCenterpiece ? EXHIBIT_LABEL_SIZE.centerpieceDepth : EXHIBIT_LABEL_SIZE.depth]} scale={[EXHIBIT_LABEL_SIZE.width, EXHIBIT_LABEL_SIZE.height, 1]}>
    {/* Billboard annotations stay legible when the view crosses the plinth. */}
    <spriteMaterial map={texture} toneMapped={false} depthTest={false} depthWrite={false} />
  </sprite>;
}
