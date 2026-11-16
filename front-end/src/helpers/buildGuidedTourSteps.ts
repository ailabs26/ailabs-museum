import type { GuidedTourStep } from '@/interfaces/guidedTour';
import type { RoomDetail } from '@/validations/roomSchema';
import { sortForTour } from './tourOrder';

export function buildGuidedTourSteps(room: RoomDetail): GuidedTourStep[] {
  return sortForTour(room.exhibits).map(({ id }) => ({ roomId: room.id, exhibitId: id }));
}
