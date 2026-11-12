import type { MuseumDisplay } from '@/interfaces/museumScene';
import { GallerySlotView, type ExhibitRenderProps } from './GallerySlotView';

/** Phòng legacy: bục đi theo tọa độ tự do và hình dạng của từng hiện vật, như trước Gallery Template. */
export function ExhibitionDisplay({ display, ...content }: ExhibitRenderProps & { display: MuseumDisplay }) {
  const isCenterpiece = !!display.model || display.shape === 'torus';
  const isRoundPlinth = isCenterpiece || display.shape === 'sphere' || display.shape === 'cylinder';
  return <GallerySlotView position={display.position} pedestal={isCenterpiece ? 'hero' : isRoundPlinth ? 'standard' : 'square'} exhibit={display} {...content} />;
}
