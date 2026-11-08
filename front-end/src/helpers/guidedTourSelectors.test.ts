import { describe, expect, it } from 'vitest';
import { INITIAL_GUIDED_TOUR_STATE, type GuidedTourState, type GuidedTourStep } from '@/interfaces/guidedTour';
import { selectGuidedTour } from './guidedTourSelectors';

const roomId = '00000000-0000-4000-8000-000000000001';
const steps: GuidedTourStep[] = [
  { roomId, exhibitId: 'exhibit-a' },
  { roomId, exhibitId: 'exhibit-b' },
];

const state = (status: GuidedTourState['status'], currentIndex: number): GuidedTourState => ({
  status,
  session: { roomId, roomSlug: 'sculpture', steps, currentIndex },
});

describe('selectGuidedTour', () => {
  it('returns empty selectors while idle', () => {
    expect(selectGuidedTour(INITIAL_GUIDED_TOUR_STATE)).toEqual({
      status: 'idle', steps: [], currentStep: null, currentIndex: -1,
      total: 0, progress: 0, canNext: false, canPrevious: false,
    });
  });

  it('derives the current step and step-based progress', () => {
    expect(selectGuidedTour(state('running', 0))).toMatchObject({
      currentStep: steps[0], currentIndex: 0, total: 2, progress: 0.5,
      canNext: true, canPrevious: false,
    });
    expect(selectGuidedTour(state('paused', 1))).toMatchObject({
      currentStep: steps[1], currentIndex: 1, total: 2, progress: 1,
      canNext: true, canPrevious: true,
    });
  });

  it('marks completed progress as full and disables next', () => {
    expect(selectGuidedTour(state('completed', 1))).toMatchObject({ progress: 1, canNext: false, canPrevious: true });
  });
});
