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
  finishBinding?: () => void;
}
declare global { interface Window { museumXrFixture: SimulatedXr } }

/** API simulation, not an installed emulator or headset certification.
 * Uses the actual WebXRManager, R3F XR scheduling and software WebGL rendering. */
export async function installXrSimulation(page: Page, options: { holdBinding?: boolean; failBinding?: boolean } = {}) {
  await page.addInitScript(options => {
    const matrix = (x = 0, y = 0, z = 0) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    const state: SimulatedXr = {
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
    };
    Object.defineProperty(state.source, 'gamepad', { get: () => ({ mapping: 'xr-standard', axes: state.axes }) });
    state.sources = [state.source]; window.museumXrFixture = state;
    function makeFrame() {
      const near = 0.1, far = 40;
      const projectionMatrix = [1.2, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
      return {
        session: state.session,
        getViewerPose: () => ({ transform: { matrix: state.head }, views: ['left', 'right'].map((eye, index) => {
          const pose = state.head.slice(), offset = index ? 0.032 : -0.032;
          for (let axis = 0; axis < 3; axis++) pose[12 + axis] += pose[axis] * offset;
          return { eye, transform: { matrix: pose }, projectionMatrix };
        }) }),
        getPose: () => ({ transform: { matrix: state.ray }, emulatedPosition: false }),
      };
    }
    class Session extends EventTarget {
      visibilityState = 'visible'; environmentBlendMode = 'opaque'; enabledFeatures = ['local-floor'];
      renderState: Record<string, unknown> = {};
      ended = false;
      get inputSources() { return state.sources; }
      referenceRequests = 0;
      requestReferenceSpace = async () => {
        if (++this.referenceRequests > 1) {
          if (options.holdBinding) await new Promise<void>(resolve => { state.finishBinding = resolve; });
          if (options.failBinding) throw new Error('Simulated native binding interruption');
        }
        return new EventTarget();
      };
      updateRenderState = (options: Record<string, unknown>) => Object.assign(this.renderState, options);
      requestAnimationFrame = (callback: (time: number, frame: unknown) => void) => requestAnimationFrame(time => { if (!this.ended) callback(time, makeFrame()); });
      cancelAnimationFrame = (id: number) => cancelAnimationFrame(id);
      end = async () => { if (!this.ended) { this.ended = true; state.ends++; this.dispatchEvent(new Event('end')); } };
    }
    class Layer {
      framebuffer = null;
      framebufferWidth: number; framebufferHeight: number;
      fixedFoveation = 1;
      constructor(_session: unknown, gl: WebGL2RenderingContext) { this.framebufferWidth = gl.drawingBufferWidth; this.framebufferHeight = gl.drawingBufferHeight; }
      getViewport(view: { eye: string }) { return { x: view.eye === 'right' ? this.framebufferWidth / 2 : 0, y: 0, width: this.framebufferWidth / 2, height: this.framebufferHeight }; }
    }
    Object.defineProperty(window, 'XRWebGLLayer', { configurable: true, value: Layer });
    Object.defineProperty(WebGL2RenderingContext.prototype, 'makeXRCompatible', { configurable: true, value: async () => {} });
    Object.defineProperty(navigator, 'xr', { configurable: true, value: Object.assign(new EventTarget(), {
      isSessionSupported: async () => true,
      requestSession: async () => { state.requests++; const session = new Session(); state.session = session as unknown as XRSession; return session; },
    }) });
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
