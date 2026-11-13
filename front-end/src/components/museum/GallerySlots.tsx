import type { ResolvedGallerySlot } from '@/helpers/gallerySlots';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { GallerySlotView, type ExhibitRenderProps } from './GallerySlotView';

/** Gallery Template V1: luôn dựng đủ 5 bục theo contract; hiện vật chỉ xuất hiện ở bục được gán. */
export function GallerySlots({ slots, getExhibitProps }: {
  slots: readonly ResolvedGallerySlot[]; getExhibitProps: (display: MuseumDisplay) => ExhibitRenderProps;
}) {
  return <group name="Gallery slots">
    {slots.map(({ slot, exhibit }) => <GallerySlotView key={slot.id} slotId={slot.id} position={slot.position} pedestal={slot.plinthKind} hasTrim
      exhibit={exhibit} {...(exhibit ? getExhibitProps(exhibit) : EMPTY_SLOT)} />)}
  </group>;
}

const EMPTY_SLOT: ExhibitRenderProps = { isSelected: false, onSelect: () => {}, onRenderError: () => {} };
