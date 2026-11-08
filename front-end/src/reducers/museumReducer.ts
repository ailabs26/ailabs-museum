//
import {
  INITIAL_GUIDED_TOUR_STATE,
  type GuidedTourState,
  type GuidedTourStep,
} from '@/interfaces/guidedTour';

type StartAction = {
  type: 'START';
  roomId: string;
  roomSlug: string;
  steps: readonly GuidedTourStep[];
  initialExhibitId?: string;
};

export type MuseumAction = StartAction | { type: 'PAUSE' } | { type: 'RESUME' } | { type: 'EXIT' } | { type: 'NEXT' };

export function museumReducer(
  state: GuidedTourState = INITIAL_GUIDED_TOUR_STATE,
  action: MuseumAction,
): GuidedTourState {
  if (action.type === 'EXIT') return INITIAL_GUIDED_TOUR_STATE;
  if (action.type === 'PAUSE') return state.status === 'running' ? { ...state, status: 'paused' } : state;
  if (action.type === 'RESUME') return state.status === 'paused' ? { ...state, status: 'running' } : state;
  if (action.type === 'NEXT') {
    if ((state.status !== 'running' && state.status !== 'paused') || !state.session) return state;
    if (state.session.currentIndex === state.session.steps.length - 1) return { ...state, status: 'completed' };
    return { ...state, session: { ...state.session, currentIndex: state.session.currentIndex + 1 } };
  }
  if (!action.steps.length
    || action.steps.some((step) => step.roomId !== action.roomId)
    || new Set(action.steps.map((step) => step.exhibitId)).size !== action.steps.length) return state;

  const currentIndex = action.initialExhibitId === undefined
    ? 0
    : action.steps.findIndex((step) => step.exhibitId === action.initialExhibitId);
  if (currentIndex < 0) return state;

  return {
    status: 'running',
    session: { roomId: action.roomId, roomSlug: action.roomSlug, steps: action.steps, currentIndex },
  };
}
