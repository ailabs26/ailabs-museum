import { expect, it } from 'vitest';
import { exhibitSearchNavigationReducer as reduce, INITIAL_EXHIBIT_SEARCH_NAVIGATION, type ExhibitSearchRequest } from './exhibitSearchNavigationReducer';

const a: ExhibitSearchRequest = { exhibitId: 'A', requestId: 1, issuedAt: 10 };
const again: ExhibitSearchRequest = { exhibitId: 'A', requestId: 2, issuedAt: 20 };
const b: ExhibitSearchRequest = { exhibitId: 'B', requestId: 3, issuedAt: 30 };

it('same exhibit issued again has a fresh identity and rejects the earlier completion', () => {
  const first = reduce(INITIAL_EXHIBIT_SEARCH_NAVIGATION, { type: 'navigate', request: a });
  const second = reduce(first, { type: 'navigate', request: again });
  expect(second.phase).toBe('moving');
  expect(reduce(second, { type: 'result', request: a, outcome: 'arrived' })).toBe(second);
  expect(reduce(second, { type: 'result', request: again, outcome: 'arrived' }).phase).toBe('arrived');
});

it('A → B rejects stale blocked and arrived outcomes, then accepts only B', () => {
  const state = reduce(reduce(INITIAL_EXHIBIT_SEARCH_NAVIGATION, { type: 'navigate', request: a }), { type: 'navigate', request: b });
  for (const outcome of ['arrived', 'blocked'] as const) expect(reduce(state, { type: 'result', request: a, outcome })).toBe(state);
  const blocked = reduce(state, { type: 'result', request: b, outcome: 'blocked' });
  expect(blocked.phase).toBe('blocked');
  expect(reduce(blocked, { type: 'result', request: b, outcome: 'arrived' })).toBe(blocked);
});

it('cancellation invalidates pending arrival and a subsequent intent can still navigate', () => {
  const moving = reduce(INITIAL_EXHIBIT_SEARCH_NAVIGATION, { type: 'navigate', request: a });
  const cancelled = reduce(moving, { type: 'cancel' });
  expect(cancelled.phase).toBe('cancelled');
  expect(reduce(cancelled, { type: 'result', request: a, outcome: 'arrived' })).toBe(cancelled);
  expect(reduce(cancelled, { type: 'navigate', request: b })).toEqual({ request: b, phase: 'moving' });
  expect(reduce(INITIAL_EXHIBIT_SEARCH_NAVIGATION, { type: 'cancel' })).toBe(INITIAL_EXHIBIT_SEARCH_NAVIGATION);
});
