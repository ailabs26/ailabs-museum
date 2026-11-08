import { describe, expect, it } from 'vitest';
import { INITIAL_GUIDED_TOUR_STATE, type GuidedTourStep } from '@/interfaces/guidedTour';
import { museumReducer } from './museumReducer';

const roomId = '00000000-0000-4000-8000-000000000001';
const steps: GuidedTourStep[] = [
  { roomId, exhibitId: 'exhibit-a' },
  { roomId, exhibitId: 'exhibit-b' },
];

const start = (tourSteps = steps, initialExhibitId?: string) => ({
  type: 'START' as const,
  roomId,
  roomSlug: 'sculpture',
  steps: tourSteps,
  initialExhibitId,
});

describe('museumReducer START', () => {
  it('starts at the first step by default and can start at a requested exhibit', () => {
    expect(museumReducer(INITIAL_GUIDED_TOUR_STATE, start())).toMatchObject({
      status: 'running',
      session: { roomId, roomSlug: 'sculpture', steps, currentIndex: 0 },
    });
    expect(museumReducer(INITIAL_GUIDED_TOUR_STATE, start(steps, 'exhibit-b')).session?.currentIndex).toBe(1);
  });

  it('does not start an empty room or an unknown initial exhibit', () => {
    expect(museumReducer(INITIAL_GUIDED_TOUR_STATE, start([]))).toBe(INITIAL_GUIDED_TOUR_STATE);
    expect(museumReducer(INITIAL_GUIDED_TOUR_STATE, start(steps, 'missing'))).toBe(INITIAL_GUIDED_TOUR_STATE);
  });

  it('replaces an existing session when explicitly started again', () => {
    const active = museumReducer(INITIAL_GUIDED_TOUR_STATE, start());
    const nextRoomId = '00000000-0000-4000-8000-000000000002';
    const next = museumReducer(active, {
      type: 'START', roomId: nextRoomId, roomSlug: 'ceramics',
      steps: [{ roomId: nextRoomId, exhibitId: 'vase' }],
    });

    expect(next).toMatchObject({ status: 'running', session: { roomId: nextRoomId, roomSlug: 'ceramics', currentIndex: 0 } });
  });
});

describe('museumReducer PAUSE and RESUME', () => {
  it('pauses and resumes without changing the selected step or step order', () => {
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start(steps, 'exhibit-b'));
    const paused = museumReducer(running, { type: 'PAUSE' });
    const resumed = museumReducer(paused, { type: 'RESUME' });

    expect(paused).toEqual({ ...running, status: 'paused' });
    expect(resumed).toEqual(running);
  });

  it('keeps the same state for repeated or invalid pause/resume commands', () => {
    const idlePause = museumReducer(INITIAL_GUIDED_TOUR_STATE, { type: 'PAUSE' });
    const idleResume = museumReducer(INITIAL_GUIDED_TOUR_STATE, { type: 'RESUME' });
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start());
    const paused = museumReducer(running, { type: 'PAUSE' });

    expect(idlePause).toBe(INITIAL_GUIDED_TOUR_STATE);
    expect(idleResume).toBe(INITIAL_GUIDED_TOUR_STATE);
    expect(museumReducer(running, { type: 'PAUSE' })).toMatchObject({ status: 'paused' });
    expect(museumReducer(paused, { type: 'PAUSE' })).toBe(paused);
    expect(museumReducer(running, { type: 'RESUME' })).toBe(running);
  });
});

describe('museumReducer EXIT', () => {
  it('clears any session idempotently and allows a fresh start', () => {
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start());
    const paused = museumReducer(running, { type: 'PAUSE' });
    const exited = museumReducer(paused, { type: 'EXIT' });

    expect(exited).toBe(INITIAL_GUIDED_TOUR_STATE);
    expect(museumReducer(exited, { type: 'EXIT' })).toBe(exited);
    expect(museumReducer(exited, start(steps, 'exhibit-b'))).toMatchObject({
      status: 'running', session: { currentIndex: 1, steps },
    });
  });
});

describe('museumReducer NEXT', () => {
  it('advances one step and preserves running or paused status before the end', () => {
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start());
    const runningNext = museumReducer(running, { type: 'NEXT' });
    const paused = museumReducer(running, { type: 'PAUSE' });
    const pausedNext = museumReducer(paused, { type: 'NEXT' });

    expect(runningNext).toMatchObject({ status: 'running', session: { currentIndex: 1 } });
    expect(pausedNext).toMatchObject({ status: 'paused', session: { currentIndex: 1 } });
  });

  it('completes at the last step without wrapping and ignores further next commands', () => {
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start(steps, 'exhibit-b'));
    const completed = museumReducer(running, { type: 'NEXT' });
    const single = museumReducer(INITIAL_GUIDED_TOUR_STATE, start([steps[0]]) );

    expect(completed).toMatchObject({ status: 'completed', session: { currentIndex: 1, steps } });
    expect(museumReducer(completed, { type: 'NEXT' })).toBe(completed);
    expect(museumReducer(single, { type: 'NEXT' }).status).toBe('completed');
    expect(museumReducer(INITIAL_GUIDED_TOUR_STATE, { type: 'NEXT' })).toBe(INITIAL_GUIDED_TOUR_STATE);
  });
});

describe('museumReducer PREVIOUS', () => {
  it('moves back without wrapping and preserves running or paused status', () => {
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start(steps, 'exhibit-b'));
    const paused = museumReducer(running, { type: 'PAUSE' });

    expect(museumReducer(running, { type: 'PREVIOUS' })).toMatchObject({ status: 'running', session: { currentIndex: 0 } });
    expect(museumReducer(paused, { type: 'PREVIOUS' })).toMatchObject({ status: 'paused', session: { currentIndex: 0 } });
    expect(museumReducer(museumReducer(running, { type: 'PREVIOUS' }), { type: 'PREVIOUS' }))
      .toMatchObject({ status: 'running', session: { currentIndex: 0 } });
  });

  it('returns from completed to paused at the prior step and keeps idle/first-step no-ops', () => {
    const single = museumReducer(INITIAL_GUIDED_TOUR_STATE, start([steps[0]]));
    const completedSingle = museumReducer(single, { type: 'NEXT' });
    const atLast = museumReducer(INITIAL_GUIDED_TOUR_STATE, start(steps));
    const completed = museumReducer(museumReducer(atLast, { type: 'NEXT' }), { type: 'NEXT' });

    expect(museumReducer(completed, { type: 'PREVIOUS' })).toMatchObject({ status: 'paused', session: { currentIndex: 0 } });
    expect(museumReducer(completedSingle, { type: 'PREVIOUS' })).toBe(completedSingle);
    expect(museumReducer(INITIAL_GUIDED_TOUR_STATE, { type: 'PREVIOUS' })).toBe(INITIAL_GUIDED_TOUR_STATE);
  });
});

describe('museumReducer GO_TO', () => {
  it('jumps by exhibit ID and ignores unknown, current, or idle targets', () => {
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start());

    expect(museumReducer(running, { type: 'GO_TO', exhibitId: 'exhibit-b' }))
      .toMatchObject({ status: 'running', session: { currentIndex: 1 } });
    expect(museumReducer(running, { type: 'GO_TO', exhibitId: 'exhibit-a' })).toBe(running);
    expect(museumReducer(running, { type: 'GO_TO', exhibitId: 'unknown' })).toBe(running);
    expect(museumReducer(INITIAL_GUIDED_TOUR_STATE, { type: 'GO_TO', exhibitId: 'exhibit-a' }))
      .toBe(INITIAL_GUIDED_TOUR_STATE);
  });

  it('moves a completed session back to paused on a valid target', () => {
    const running = museumReducer(INITIAL_GUIDED_TOUR_STATE, start());
    const completed = museumReducer(museumReducer(running, { type: 'NEXT' }), { type: 'NEXT' });

    expect(museumReducer(completed, { type: 'GO_TO', exhibitId: 'exhibit-a' }))
      .toMatchObject({ status: 'paused', session: { currentIndex: 0 } });
  });
});
