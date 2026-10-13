import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { EXHIBIT_LABEL_SIZE } from '@/interfaces/museumScene';

/** System-font plaque: no font download, DOM overlay or external texture. */
export function ExhibitLabel({ title, isSelected, isCenterpiece }: { title: string; isSelected: boolean; isCenterpiece: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#faf5eb';
      context.fillRect(0, 0, 512, 128);
      context.fillStyle = isSelected ? '#25645c' : '#b29463';
      context.fillRect(0, 0, 8, 128);
      context.fillStyle = '#253a36';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '30px Georgia, serif';
      let line = title;
      while (line.length > 1 && context.measureText(line).width > 450) line = line.slice(0, -1);
      context.fillText(line.length < title.length ? `${line}…` : line, 260, 52);
      context.font = '18px sans-serif';
      context.fillStyle = '#5e6258';
      context.fillText(isSelected ? 'ĐANG XEM' : 'CHỌN ĐỂ KHÁM PHÁ', 260, 92);
    }
    const label = new CanvasTexture(canvas);
    label.colorSpace = SRGBColorSpace;
    return label;
  }, [title, isSelected]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, 0.78, isCenterpiece ? EXHIBIT_LABEL_SIZE.centerpieceDepth : EXHIBIT_LABEL_SIZE.depth]} scale={[EXHIBIT_LABEL_SIZE.width, EXHIBIT_LABEL_SIZE.height, 1]}>
    <spriteMaterial map={texture} toneMapped={false} />
  </sprite>;
}
