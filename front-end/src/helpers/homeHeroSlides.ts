import { localizedAltText, localizeExhibit } from './localizeExhibit';
import type { RoomDetail } from '@/validations/roomSchema';

export type HomeHeroSlide = {
  key: string;
  roomSlug: string;
  exhibitId: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  detailHref: string;
  shape: RoomDetail['exhibits'][number]['placeholderShape'];
  color: string;
};

export function selectHomeHeroSlides(rooms: readonly RoomDetail[], locale: string): HomeHeroSlide[] {
  return rooms.flatMap((room) => [...room.exhibits]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
    .filter((exhibit) => !!exhibit.image?.url)
    .map((exhibit) => {
      const localized = localizeExhibit(exhibit, locale);
      const image = exhibit.image!;
      return {
        key: `${room.id}:${exhibit.id}`,
        roomSlug: room.slug,
        exhibitId: exhibit.id,
        name: localized.name,
        description: localized.description,
        imageUrl: image.url,
        imageAlt: localizedAltText(image.altText, locale, localized.name),
        detailHref: `/collection/${encodeURIComponent(room.slug)}/exhibits/${encodeURIComponent(exhibit.id)}`,
        shape: exhibit.placeholderShape,
        color: exhibit.placeholderColor,
      };
    }))
    .slice(0, 5);
}
