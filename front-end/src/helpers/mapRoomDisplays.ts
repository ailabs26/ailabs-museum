import type { RoomDetail } from '@/validations/roomSchema';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { isDisplayOutsideRoom } from './isDisplayOutsideRoom';

/** Backend coordinates anchor the existing display group, in metres / Y up. */
export function mapRoomDisplays(room: RoomDetail): MuseumDisplay[] {
  const exhibits = [...room.exhibits].sort((left, right) =>
    left.displayOrder - right.displayOrder || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const hasModels = exhibits.some(exhibit => exhibit.model);
  const columns = hasModels ? Math.min(4, Math.ceil(Math.sqrt(exhibits.length))) : Math.ceil(Math.sqrt(exhibits.length));
  const rows = Math.ceil(exhibits.length / columns);
  return exhibits.map((exhibit, index) => {
    const display: MuseumDisplay = {
      id: exhibit.id,
      title: exhibit.name,
      description: exhibit.description,
      transcript: exhibit.transcript,
      hotspots: [...exhibit.hotspots].sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
        .map(({ id, label, body }) => ({ id, label, body })),
      position: exhibit.positionX !== undefined && exhibit.positionY !== undefined && exhibit.positionZ !== undefined
        ? [exhibit.positionX, exhibit.positionY, exhibit.positionZ]
        : hasModels ? [((index % columns) - (columns - 1) / 2) * 3.6, 0, (Math.floor(index / columns) - (rows - 1) / 2) * 3.6]
        : [columns === 1 ? 0 : -5.3 + (index % columns) * 10.6 / (columns - 1), 0,
          rows === 1 ? 0 : -5.1 + Math.floor(index / columns) * 10.2 / (rows - 1)],
      shape: exhibit.placeholderShape === 'box' ? 'cube' : exhibit.placeholderShape,
      color: exhibit.placeholderColor,
      ...(exhibit.model ? { model: exhibit.model } : {}),
    };
    return { ...display, isOutsideRoom: isDisplayOutsideRoom(display) };
  });
}
