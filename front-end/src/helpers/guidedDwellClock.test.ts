import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedDwellClock } from './guidedDwellClock';

describe('GuidedDwellClock', () => {
  afterEach(() => vi.useRealTimers());

  it('retains only the time remaining when paused and resumes it once', () => {
    vi.useFakeTimers();
    let now = 0;
    const clock = new GuidedDwellClock(() => now);
    clock.reset('session-a:exhibit-a');
    const onElapsed = vi.fn();

    clock.start('session-a:exhibit-a', onElapsed);
    now += 5_000;
    vi.advanceTimersByTime(5_000);
    clock.pause();
    now += 30_000;
    vi.advanceTimersByTime(30_000);
    expect(clock.remaining('session-a:exhibit-a')).toBe(10_000);

    clock.start('session-a:exhibit-a', onElapsed);
    now += 9_999;
    vi.advanceTimersByTime(9_999);
    expect(onElapsed).not.toHaveBeenCalled();
    now += 1;
    vi.advanceTimersByTime(1);
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it('ignores a callback from an invalidated step', () => {
    vi.useFakeTimers();
    const clock = new GuidedDwellClock(() => 0);
    clock.reset('session-a:exhibit-a');
    const onElapsed = vi.fn();

    clock.start('session-a:exhibit-a', onElapsed);
    vi.advanceTimersByTime(5_000);
    clock.reset('session-a:exhibit-b');
    vi.advanceTimersByTime(15_000);

    expect(onElapsed).not.toHaveBeenCalled();
    expect(clock.remaining('session-a:exhibit-b')).toBe(15_000);
  });

  it('does not fire in the paused route when zero is reached before pause', () => {
    vi.useFakeTimers();
    let now = 0;
    const clock = new GuidedDwellClock(() => now);
    clock.reset('session-a:exhibit-a');
    const onElapsed = vi.fn();

    clock.start('session-a:exhibit-a', onElapsed);
    now += 15_000;
    clock.pause();
    expect(clock.remaining('session-a:exhibit-a')).toBe(0);
    vi.advanceTimersByTime(30_000);
    expect(onElapsed).not.toHaveBeenCalled();

    clock.start('session-a:exhibit-a', onElapsed);
    vi.runOnlyPendingTimers();

    expect(onElapsed).toHaveBeenCalledTimes(1);
  });
});
