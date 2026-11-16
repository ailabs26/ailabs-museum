import { describe, expect, it } from 'vitest';
import { INITIAL_GUIDED_TOUR_STATE, type GuidedTourState, type GuidedTourStep } from '@/interfaces/guidedTour';
import { museumReducer } from '@/reducers/museumReducer';
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

  it('keeps completed progress at 1 after reorder or adding steps', () => {
    const started = museumReducer(INITIAL_GUIDED_TOUR_STATE, {
      type: 'START', roomId, roomSlug: 'sculpture', steps, initialExhibitId: 'exhibit-b',
    });
    const completed = museumReducer(started, { type: 'NEXT' });

    for (const updatedSteps of [
      [steps[1], steps[0]],
      [steps[1], steps[0], { roomId, exhibitId: 'exhibit-c' }],
    ]) {
      const reconciled = museumReducer(completed, {
        type: 'RECONCILE_ROOM', roomId, roomSlug: 'sculpture', steps: updatedSteps,
      });

      expect(reconciled).toMatchObject({ status: 'completed', session: { currentIndex: 0 } });
      expect(selectGuidedTour(reconciled)).toMatchObject({ progress: 1, canNext: false });
    }
  });
});
