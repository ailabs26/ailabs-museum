import type { Page } from '@playwright/test';

interface SimulatedXr {
  requests: number;
  ends: number;
  source: XRInputSource;
  session: XRSession | null;
  ray: number[];
  head: number[];
  axes: number[];
  sources: XRInputSource[];
  select: () => void;
  disconnect: () => void;
  available: boolean;
  sessions: XRSession[];
  timeline: { event: string; session: number; available: boolean }[];
  listeners: Record<string, number>[];
  endCalls: number;
  setAvailable: (available: boolean) => void;
  terminateHeadset: (order?: 'end-first' | 'device-first') => void;
  visibility: (value: XRVisibilityState) => void;
  finishRequest?: () => void;
  finishCompatibility?: () => void;
  finishBinding?: () => void;
}
declare global { interface Window { museumXrFixture: SimulatedXr } }

/** API simulation, not an installed emulator or headset certification.
 * Uses the actual WebXRManager, R3F XR scheduling and software WebGL rendering. */
export async function installXrSimulation(page: Page, options: { holdBinding?: boolean; failBinding?: boolean; holdCompatibility?: boolean; holdRequest?: boolean } = {}) {
  await page.addInitScript(options => {
    const matrix = (x = 0, y = 0, z = 0) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    const state: SimulatedXr = {
      available: true, sessions: [], timeline: [], listeners: [], endCalls: 0,
      requests: 0, ends: 0, session: null, ray: matrix(0.2, 1.3, -0.3), head: matrix(0, 1.7, 0), axes: [0, 0, 0, 0], sources: [],
      source: { handedness: 'right', targetRayMode: 'tracked-pointer', targetRaySpace: {}, profiles: ['oculus-touch-v3'] } as XRInputSource,
      select() {
        if (!state.session) return;
        for (const type of ['selectstart', 'selectend', 'select']) state.session.dispatchEvent(Object.assign(new Event(type), { inputSource: state.source, frame: makeFrame() }));
      },
      disconnect() {
        const removed = state.sources; state.sources = [];
        state.session?.dispatchEvent(Object.assign(new Event('inputsourceschange'), { added: [], removed }));
      },
      setAvailable(available) {
        state.available = available;
        record('devicechange');
        system.dispatchEvent(new Event('devicechange'));
      },
      terminateHeadset(order = 'end-first') {
        const session = state.session as unknown as Session | null;
        if (order === 'device-first') state.setAvailable(false);
        session?.terminate();
        if (order === 'end-first') state.setAvailable(false);
      },
      visibility(value) {
        const session = state.session as unknown as Session;
        session.visibilityState = value;
        record(`visibility:${value}`);
        session.dispatchEvent(new Event('visibilitychange'));
      },
    };
    const record = (event: string, session = state.sessions.indexOf(state.session!)) => {
      state.timeline.push({ event, session, available: state.available });
    };
    Object.defineProperty(state.source, 'gamepad', { get: () => ({ mapping: 'xr-standard', axes: state.axes }) });
    state.sources = [state.source]; window.museumXrFixture = state;
    function makeFrame(session = state.session) {
      const near = 0.1, far = 40;
      const projectionMatrix = [1.2, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
      return {
        session,
        getViewerPose: () => ({ transform: { matrix: state.head }, views: ['left', 'right'].map((eye, index) => {
          const pose = state.head.slice(), offset = index ? 0.032 : -0.032;
          for (let axis = 0; axis < 3; axis++) pose[12 + axis] += pose[axis] * offset;
          return { eye, transform: { matrix: pose }, projectionMatrix };
        }) }),
        getPose: () => ({ transform: { matrix: state.ray }, emulatedPosition: false }),
      };
    }
    class Session extends EventTarget {
      visibilityState: XRVisibilityState = 'visible'; environmentBlendMode = 'opaque'; enabledFeatures = ['local-floor'];
      id = state.sessions.length;
      registrations = new Map<string, Set<EventListenerOrEventListenerObject>>();
      constructor() { super(); state.listeners.push({}); }
      // Count actual outstanding registrations by type and capture flag. The
      // native EventTarget still implements delivery and stopImmediatePropagation.
      override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        super.addEventListener(type, callback, options);
        if (!callback) return;
        const key = `${type}:${typeof options === 'boolean' ? options : !!options?.capture}`;
        const callbacks = this.registrations.get(key) ?? new Set();
        callbacks.add(callback); this.registrations.set(key, callbacks); this.count(type);
      }
      override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
        super.removeEventListener(type, callback, options);
        const key = `${type}:${typeof options === 'boolean' ? options : !!options?.capture}`;
        if (callback) this.registrations.get(key)?.delete(callback);
        this.count(type);
      }
      count(type: string) {
        state.listeners[this.id][type] = [...this.registrations].filter(([key]) => key.startsWith(`${type}:`)).reduce((sum, [, callbacks]) => sum + callbacks.size, 0);
      }
      renderState: Record<string, unknown> = {};
      ended = false;
      get inputSources() { return state.sources; }
      referenceRequests = 0;
      requestReferenceSpace = async () => {
        // A UA-ended session rejects new reference-space requests, even when
        // requestSession's promise is delivered after the native end signal.
        if (this.ended) throw new DOMException('Session already ended', 'InvalidStateError');
        if (++this.referenceRequests > 1) {
          record('binding:start', this.id);
          if (options.holdBinding) await new Promise<void>(resolve => { state.finishBinding = () => { record('binding:resolve', this.id); resolve(); }; record('binding:pending', this.id); });
          if (options.failBinding) throw new Error('Simulated native binding interruption');
        }
        return new EventTarget();
      };
      updateRenderState = (options: Record<string, unknown>) => Object.assign(this.renderState, options);
      requestAnimationFrame = (callback: (time: number, frame: unknown) => void) => requestAnimationFrame(time => { if (!this.ended) callback(time, makeFrame(this as unknown as XRSession)); });
      cancelAnimationFrame = (id: number) => cancelAnimationFrame(id);
      terminate = () => { if (!this.ended) { this.ended = true; state.ends++; record('native:end', this.id); this.dispatchEvent(new Event('end')); } };
      end = async () => { state.endCalls++; record('app:end', this.id); this.terminate(); };
    }
    class Layer {
      framebuffer = null;
      framebufferWidth: number; framebufferHeight: number;
      fixedFoveation = 1;
      constructor(_session: unknown, gl: WebGL2RenderingContext) { this.framebufferWidth = gl.drawingBufferWidth; this.framebufferHeight = gl.drawingBufferHeight; }
      getViewport(view: { eye: string }) { return { x: view.eye === 'right' ? this.framebufferWidth / 2 : 0, y: 0, width: this.framebufferWidth / 2, height: this.framebufferHeight }; }
    }
    Object.defineProperty(window, 'XRWebGLLayer', { configurable: true, value: Layer });
    Object.defineProperty(WebGL2RenderingContext.prototype, 'makeXRCompatible', { configurable: true, value: async () => {
      if (options.holdCompatibility) await new Promise<void>(resolve => { state.finishCompatibility = resolve; record('compatibility:pending'); });
    } });
    const system = Object.assign(new EventTarget(), {
      isSessionSupported: async () => state.available,
      requestSession: async () => {
        state.requests++;
        const session = new Session(); state.session = session as unknown as XRSession;
        state.sessions.push(state.session); state.sources = [state.source]; record('request');
        if (options.holdRequest) await new Promise<void>(resolve => { state.finishRequest = resolve; });
        return session;
      },
    });
    Object.defineProperty(navigator, 'xr', { configurable: true, value: system });
  }, options);
}

/** Aim a native input source at a world point using the actual XR origin. */
export async function aimXr(page: Page, point: number[]) {
  await page.evaluate(point => {
    const camera = window.museumProbe.at(-1)!.camera!.deref()!;
    const origin = camera.parent!; origin.updateMatrixWorld(true);
    const start = camera.position.clone().set(0.4, 1.3, -0.3);
    const destination = origin.worldToLocal(camera.position.clone().fromArray(point));
    const matrix = camera.matrix.clone().lookAt(start, destination, camera.up).setPosition(start);
    window.museumXrFixture.ray = matrix.toArray();
  }, point);
}
