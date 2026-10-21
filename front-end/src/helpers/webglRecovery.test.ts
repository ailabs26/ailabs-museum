import { afterEach, expect, it, vi } from 'vitest';
import { watchWebglRecovery } from './webglRecovery';
afterEach(() => vi.useRealTimers());
it('prevents loss, waits for a verified rendered frame and preserves a bounded recovery budget', () => {
  vi.useFakeTimers(); const canvas = new EventTarget(); const changed = vi.fn();
  const recovery = watchWebglRecovery(canvas, changed);
  const loss = new Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(loss);
  expect(loss.defaultPrevented).toBe(true); expect(changed).toHaveBeenLastCalledWith('recovering');
  canvas.dispatchEvent(new Event('webglcontextrestored')); expect(changed).toHaveBeenLastCalledWith('verifying');
  recovery.frameRendered(); expect(changed).toHaveBeenLastCalledWith('ready');
  canvas.dispatchEvent(new Event('webglcontextlost')); canvas.dispatchEvent(new Event('webglcontextrestored')); recovery.frameRendered();
  canvas.dispatchEvent(new Event('webglcontextlost')); expect(changed).toHaveBeenLastCalledWith('failed');
  canvas.dispatchEvent(new Event('webglcontextrestored')); recovery.frameRendered();
  expect(changed).toHaveBeenLastCalledWith('failed'); recovery.dispose();
});
it('times out into stable 2D and ignores unsolicited restore and duplicate losses', () => {
  vi.useFakeTimers(); const canvas = new EventTarget(), changed = vi.fn(); const recovery = watchWebglRecovery(canvas, changed);
  canvas.dispatchEvent(new Event('webglcontextrestored')); expect(changed).not.toHaveBeenCalled();
  canvas.dispatchEvent(new Event('webglcontextlost')); canvas.dispatchEvent(new Event('webglcontextlost'));
  expect(changed).toHaveBeenCalledTimes(1); vi.advanceTimersByTime(8000);
  expect(changed).toHaveBeenLastCalledWith('failed'); recovery.dispose();
});
it('removes canvas listeners and cancels deadlines on unmount', () => {
  vi.useFakeTimers(); const canvas = new EventTarget(), changed = vi.fn(); const recovery = watchWebglRecovery(canvas, changed);
  canvas.dispatchEvent(new Event('webglcontextlost')); recovery.dispose(); changed.mockClear();
  vi.runAllTimers(); canvas.dispatchEvent(new Event('webglcontextlost')); expect(changed).not.toHaveBeenCalled();
});
