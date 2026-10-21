export interface XrSnapshot {
  capability: 'checking' | 'ready' | 'unavailable';
  phase: 'idle' | 'requesting' | 'active' | 'ending';
  message: string;
}
interface XrSessionOptions {
  xr?: XRSystem;
  secure: boolean;
  attach: (session: XRSession, type: 'local-floor' | 'local', space: XRReferenceSpace) => Promise<void>;
  detach: () => void;
}

/** Owns one immersive session, including requests that outlive a mounted scene.
 * Renderer availability is deliberately separate from XR capability. */
export class XrSessionController {
  private snapshot: XrSnapshot = { capability: 'checking', phase: 'idle', message: '' };
  private listeners = new Set<() => void>();
  private session: XRSession | null = null;
  private disposed = false;
  private generation = 0;
  private checkGeneration = 0;
  private attached = false;
  private pending = false;
  private binding: Promise<void> | null = null;
  constructor(private readonly options: XrSessionOptions) {
    options.xr?.addEventListener('devicechange', this.handleDeviceChange);
  }
  getSnapshot = () => this.snapshot;
  getSession = () => this.session;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(change: Partial<XrSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach(listener => listener());
  }
  private handleDeviceChange = () => { void this.check(); };
  async check() {
    const generation = ++this.checkGeneration;
    const { xr, secure } = this.options;
    let supported = false;
    try { supported = !!(secure && xr && await xr.isSessionSupported('immersive-vr')); } catch { /* Permission policy is a capability limitation. */ }
    if (generation === this.checkGeneration) this.update({ capability: supported ? 'ready' : 'unavailable' });
  }
  // Keep requestSession in this synchronous call stack: it requires user activation.
  enter = async () => {
    if (this.disposed || this.pending || this.snapshot.capability !== 'ready' || this.snapshot.phase !== 'idle') return;
    this.pending = true;
    const generation = ++this.generation;
    this.update({ phase: 'requesting', message: '' });
    let session: XRSession | undefined;
    try {
      const request = this.options.xr!.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      session = await request;
      if (this.disposed || generation !== this.generation) { await this.endQuietly(session); return; }
      this.session = session;
      session.addEventListener('end', this.handleEnd);
      session.addEventListener('visibilitychange', this.handleVisibility);
      let type: 'local-floor' | 'local' = 'local-floor';
      let space: XRReferenceSpace;
      try { space = await session.requestReferenceSpace(type); }
      catch { type = 'local'; space = await session.requestReferenceSpace(type); }
      if (!this.isCurrent(session, generation)) return;
      this.attached = true; // detach also owns partially initialized renderers.
      this.binding = this.options.attach(session, type, space);
      await this.binding;
      if (!this.isCurrent(session, generation)) return;
      this.update({ phase: 'active' });
    } catch {
      if (session) {
        await this.endQuietly(session);
        if (this.session === session) this.release();
      }
      if (generation === this.generation) this.update({ phase: 'idle', message: 'Không thể vào VR. Bạn vẫn có thể tham quan 3D và thử lại.' });
    } finally { this.pending = false; this.binding = null; }
  };
  private isCurrent(session: XRSession, generation: number) {
    return !this.disposed && generation === this.generation && this.session === session;
  }
  private async endQuietly(session: XRSession) { try { await session.end(); } catch { /* Already ended/disconnected. */ } }
  private handleVisibility = () => {
    if (this.session?.visibilityState === 'hidden') void this.exit();
  };
  private handleEnd = () => { this.release(); };
  private release() {
    this.session?.removeEventListener('end', this.handleEnd);
    this.session?.removeEventListener('visibilitychange', this.handleVisibility);
    this.session = null;
    if (this.attached) { this.attached = false; this.options.detach(); }
    this.update({ phase: 'idle' });
  }
  exit = async () => {
    if (this.snapshot.phase === 'ending') return;
    ++this.generation; // A pending request/reference-space/bind may no longer activate.
    const session = this.session;
    if (!session) { this.update({ phase: 'idle' }); return; }
    this.update({ phase: 'ending' });
    // WebXRManager.setSession is asynchronous and cannot be cancelled. End
    // after it settles, otherwise it can resurrect presentation after `end`.
    if (this.binding) { try { await this.binding; } catch { /* Entry failure cleans up below. */ } }
    if (this.session !== session) return;
    try { await session.end(); if (this.session === session) this.release(); }
    catch {
      if (this.session === session) this.update({ phase: 'active', message: 'Hãy dùng nút thoát VR của thiết bị hoặc thử thoát lại.' });
    }
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true; ++this.generation; ++this.checkGeneration;
    this.options.xr?.removeEventListener('devicechange', this.handleDeviceChange);
    const session = this.session;
    this.listeners.clear();
    const cleanup = async () => {
      if (this.binding) { try { await this.binding; } catch { /* Partial binding still needs teardown. */ } }
      if (session) await this.endQuietly(session);
      this.release();
    };
    void cleanup();
  }
}
