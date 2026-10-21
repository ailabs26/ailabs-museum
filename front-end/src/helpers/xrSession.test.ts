import { describe, expect, it, vi } from 'vitest';
import { XrSessionController } from './xrSession';

class Session extends EventTarget {
  visibilityState = 'visible';
  requestReferenceSpace = vi.fn(async (type: string) => ({ type }));
  end = vi.fn(async () => { this.dispatchEvent(new Event('end')); });
}
function setup({ secure = true, supported = true, system = true } = {}) {
  const session = new Session();
  const xr = Object.assign(new EventTarget(), {
    isSessionSupported: vi.fn(async () => supported), requestSession: vi.fn(async () => session),
  });
  const attach = vi.fn(async () => {}), detach = vi.fn();
  const owner = new XrSessionController({ xr: system ? xr as unknown as XRSystem : undefined, secure, attach, detach });
  return { owner, session, xr, attach, detach };
}
describe('XR capability', () => {
  it.each([{ secure: false }, { system: false }, { supported: false }])('keeps unsupported environments in web 3D: %j', async options => {
    const { owner, xr } = setup(options); await owner.check();
    expect(owner.getSnapshot().capability).toBe('unavailable');
    owner.enter(); expect(xr.requestSession).not.toHaveBeenCalled(); owner.dispose();
  });
  it('detects ready and refreshes on devicechange, absorbing permission rejection', async () => {
    const { owner, xr } = setup(); await owner.check();
    expect(owner.getSnapshot().capability).toBe('ready');
    xr.isSessionSupported.mockRejectedValueOnce(new Error('permission'));
    xr.dispatchEvent(new Event('devicechange')); await vi.waitFor(() => expect(owner.getSnapshot().capability).toBe('unavailable'));
    expect(owner.getSnapshot().phase).toBe('idle'); owner.dispose();
  });
});
describe('XR session ownership', () => {
  it('requests synchronously, suppresses duplicates, exits and re-enters', async () => {
    const { owner, xr, session, attach, detach } = setup(); await owner.check();
    const entry = owner.enter(); owner.enter();
    expect(xr.requestSession).toHaveBeenCalledTimes(1);
    expect(xr.requestSession).toHaveBeenCalledWith('immersive-vr', { optionalFeatures: ['local-floor'] });
    await entry; expect(owner.getSnapshot().phase).toBe('active'); expect(attach).toHaveBeenCalledTimes(1);
    await owner.exit(); expect(session.end).toHaveBeenCalledTimes(1); expect(detach).toHaveBeenCalledTimes(1);
    expect(owner.getSnapshot().phase).toBe('idle');
    await owner.enter(); expect(xr.requestSession).toHaveBeenCalledTimes(2); owner.dispose();
  });
  it('falls back to local, and cleans partial renderer initialization', async () => {
    const { owner, session, attach, detach } = setup(); await owner.check();
    session.requestReferenceSpace.mockRejectedValueOnce(new Error('no floor'));
    attach.mockRejectedValueOnce(new Error('bind failed'));
    await owner.enter();
    expect(attach).toHaveBeenCalledWith(session, 'local', expect.anything());
    expect(session.end).toHaveBeenCalledTimes(1); expect(detach).toHaveBeenCalledTimes(1);
    expect(owner.getSnapshot().phase).toBe('idle'); expect(owner.getSnapshot().message).toBeTruthy(); owner.dispose();
  });
  it('catches request refusal and permits retry without touching renderer', async () => {
    const { owner, xr, attach } = setup(); await owner.check(); xr.requestSession.mockRejectedValueOnce(new Error('denied'));
    await owner.enter(); expect(owner.getSnapshot().phase).toBe('idle'); expect(attach).not.toHaveBeenCalled();
    await owner.enter(); expect(owner.getSnapshot().phase).toBe('active'); owner.dispose();
  });
  it('handles system end exactly once and removes session listeners', async () => {
    const { owner, session, detach } = setup(); await owner.check(); await owner.enter();
    session.dispatchEvent(new Event('end')); session.dispatchEvent(new Event('end'));
    expect(detach).toHaveBeenCalledTimes(1); expect(owner.getSnapshot().phase).toBe('idle'); owner.dispose();
  });
  it('ends a request that resolves after disposal without binding', async () => {
    const { owner, xr, session, attach } = setup(); await owner.check();
    let resolve!: (value: Session) => void;
    xr.requestSession.mockReturnValueOnce(new Promise<Session>(done => { resolve = done; }));
    const entry = owner.enter(); owner.dispose(); resolve(session); await entry;
    expect(session.end).toHaveBeenCalledTimes(1); expect(attach).not.toHaveBeenCalled();
  });
  it('invalidates entry during reference-space or renderer initialization', async () => {
    const { owner, session, attach, detach } = setup(); await owner.check();
    let finish!: () => void; attach.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const entry = owner.enter(); await vi.waitFor(() => expect(attach).toHaveBeenCalled());
    await owner.exit(); finish(); await entry;
    expect(owner.getSnapshot().phase).toBe('idle'); expect(detach).toHaveBeenCalledTimes(1);
    session.dispatchEvent(new Event('select')); expect(owner.getSnapshot().phase).toBe('idle'); owner.dispose();
  });
  it('cleans capability listeners and does not emit after disposal', async () => {
    const { owner, xr } = setup(); const notify = vi.fn(); owner.subscribe(notify); await owner.check(); owner.dispose();
    const calls = xr.isSessionSupported.mock.calls.length; notify.mockClear(); xr.dispatchEvent(new Event('devicechange'));
    expect(xr.isSessionSupported).toHaveBeenCalledTimes(calls); expect(notify).not.toHaveBeenCalled();
  });
});
