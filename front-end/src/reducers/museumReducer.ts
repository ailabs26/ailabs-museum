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

export type MuseumAction = StartAction | { type: 'PAUSE' } | { type: 'RESUME' } | { type: 'EXIT' }
  | { type: 'NEXT' } | { type: 'PREVIOUS' } | { type: 'GO_TO'; exhibitId: string }
  | { type: 'RECONCILE_ROOM'; roomId: string; roomSlug: string; steps: readonly GuidedTourStep[] };

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
  if (action.type === 'PREVIOUS') {
    if (!state.session || state.session.currentIndex === 0) return state;
    return {
      ...state,
      status: state.status === 'completed' ? 'paused' : state.status,
      session: { ...state.session, currentIndex: state.session.currentIndex - 1 },
    };
  }
  if (action.type === 'GO_TO') {
    if (!state.session) return state;
    const currentIndex = state.session.steps.findIndex((step) => step.exhibitId === action.exhibitId);
    if (currentIndex < 0 || currentIndex === state.session.currentIndex) return state;
    return {
      ...state,
      status: state.status === 'completed' ? 'paused' : state.status,
      session: { ...state.session, currentIndex },
    };
  }
  if (action.type === 'RECONCILE_ROOM') {
    const session = state.session;
    if (!session || action.roomId !== session.roomId
      || action.steps.some((step) => step.roomId !== action.roomId)
      || new Set(action.steps.map((step) => step.exhibitId)).size !== action.steps.length) return state;
    if (!action.steps.length) return INITIAL_GUIDED_TOUR_STATE;

    const sameOrder = action.steps.length === session.steps.length
      && action.steps.every((step, index) => step.exhibitId === session.steps[index].exhibitId);
    if (sameOrder && action.roomSlug === session.roomSlug) return state;

    const currentExhibitId = session.steps[session.currentIndex].exhibitId;
    let currentIndex = action.steps.findIndex((step) => step.exhibitId === currentExhibitId);
    let status = state.status;
    if (currentIndex < 0) {
      const newIds = new Set(action.steps.map((step) => step.exhibitId));
      const fallbackId = session.steps.slice(session.currentIndex + 1).find((step) => newIds.has(step.exhibitId))?.exhibitId
        ?? session.steps.slice(0, session.currentIndex).reverse().find((step) => newIds.has(step.exhibitId))?.exhibitId;
      if (!fallbackId) return INITIAL_GUIDED_TOUR_STATE;
      currentIndex = action.steps.findIndex((step) => step.exhibitId === fallbackId);
      status = 'paused';
    }

    return {
      status,
      session: { roomId: session.roomId, roomSlug: action.roomSlug, steps: action.steps, currentIndex },
    };
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
