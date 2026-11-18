export interface ExhibitSearchRequest { exhibitId: string; requestId: number; issuedAt: number }
export type ExhibitSearchPhase = 'idle' | 'moving' | 'arrived' | 'blocked' | 'cancelled';
export interface ExhibitSearchNavigationState { request: ExhibitSearchRequest | null; phase: ExhibitSearchPhase }
type ExhibitSearchNavigationEvent = { type: 'navigate'; request: ExhibitSearchRequest }
  | { type: 'result'; request: ExhibitSearchRequest; outcome: 'arrived' | 'blocked' } | { type: 'cancel' };
export const INITIAL_EXHIBIT_SEARCH_NAVIGATION: ExhibitSearchNavigationState = { request: null, phase: 'idle' };

/** Explicit intent outcomes; this reducer never owns camera motion or selection. */
export function exhibitSearchNavigationReducer(state: ExhibitSearchNavigationState, event: ExhibitSearchNavigationEvent): ExhibitSearchNavigationState {
  if (event.type === 'navigate') return { request: event.request, phase: 'moving' };
  if (event.type === 'cancel') return state.phase === 'idle' || state.phase === 'cancelled' ? state : { ...state, phase: 'cancelled' };
  if (state.phase !== 'moving' || state.request !== event.request) return state;
  return { request: event.request, phase: event.outcome };
}
