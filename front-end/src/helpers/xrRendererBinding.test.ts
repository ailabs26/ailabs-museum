import { expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import { bindXrRenderer } from './xrRendererBinding';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function setup() {
  const session = new EventTarget() as XRSession;
  const compatible = vi.fn(async () => {}), setSession = vi.fn<(session: XRSession) => Promise<void>>(async () => {});
  const reset = vi.fn();
  const renderer = { getContext: () => ({ makeXRCompatible: compatible }), xr: { setSession } } as unknown as WebGLRenderer;
  return { session, renderer, compatible, setSession, reset };
}
it('leaves the native manager untouched when GL compatibility fails', async () => {
  const test = setup(); test.compatible.mockRejectedValueOnce(new Error('incompatible'));
  await expect(bindXrRenderer(test.renderer, test.session, test.reset)).rejects.toThrow('incompatible');
  expect(test.setSession).not.toHaveBeenCalled(); expect(test.reset).not.toHaveBeenCalled();
});
it('observes a preflight end without suppressing lifecycle cleanup or binding an ended session', async () => {
  const test = setup(), gate = deferred(), cleanup = vi.fn();
  test.session.addEventListener('end', cleanup); test.compatible.mockReturnValueOnce(gate.promise);
  const binding = bindXrRenderer(test.renderer, test.session, test.reset);
  test.session.dispatchEvent(new Event('end')); gate.resolve();
  await expect(binding).rejects.toThrow('ended before');
  expect(cleanup).toHaveBeenCalledTimes(1); expect(test.setSession).not.toHaveBeenCalled();
});
it('defers an initialization end until native cleanup can run once', async () => {
  const test = setup(), gate = deferred(), cleanup = vi.fn();
  test.setSession.mockImplementationOnce(async session => { session.addEventListener('end', cleanup); await gate.promise; });
  const binding = bindXrRenderer(test.renderer, test.session, test.reset);
  await vi.waitFor(() => expect(test.setSession).toHaveBeenCalled());
  test.session.dispatchEvent(new Event('end')); expect(cleanup).not.toHaveBeenCalled();
  gate.resolve(); await expect(binding).rejects.toThrow('ended during');
  expect(cleanup).toHaveBeenCalledTimes(1); expect(test.reset).not.toHaveBeenCalled();
});
it('retires a rejected native binding and suppresses its unsafe partial cleanup', async () => {
  const test = setup(), cleanup = vi.fn();
  test.setSession.mockImplementationOnce(async session => { session.addEventListener('end', cleanup); throw new Error('partial'); });
  await expect(bindXrRenderer(test.renderer, test.session, test.reset)).rejects.toThrow('partial');
  test.session.dispatchEvent(new Event('end'));
  expect(test.reset).toHaveBeenCalledTimes(1); expect(cleanup).not.toHaveBeenCalled();
});
it('removes its guard after normal binding so a later native end is delivered', async () => {
  const test = setup(), cleanup = vi.fn();
  test.setSession.mockImplementationOnce(async session => { session.addEventListener('end', cleanup); });
  await bindXrRenderer(test.renderer, test.session, test.reset); test.session.dispatchEvent(new Event('end'));
  expect(cleanup).toHaveBeenCalledTimes(1); expect(test.reset).not.toHaveBeenCalled();
});
