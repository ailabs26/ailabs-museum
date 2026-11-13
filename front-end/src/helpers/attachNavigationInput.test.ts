import { expect, it, vi } from 'vitest';
import { attachNavigationInput } from './attachNavigationInput';
import { createNavigationInput } from './museumNavigation';
import { NavigationGestures } from './navigationGestures';

class TrackedTarget extends EventTarget {
  listeners = new Set<EventListenerOrEventListenerObject>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (listener) this.listeners.add(listener); super.addEventListener(type, listener, options);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    if (listener) this.listeners.delete(listener); super.removeEventListener(type, listener, options);
  }
}
function setup() {
  const view = new TrackedTarget();
  const doc = Object.assign(new TrackedTarget(), { defaultView: view, activeElement: null as unknown, hidden: false });
  const capture = new Set<number>();
  const canvas = Object.assign(new TrackedTarget(), {
    ownerDocument: doc, tabIndex: -1, style: { touchAction: '' },
    setAttribute: vi.fn(), focus: () => { doc.activeElement = canvas; },
    setPointerCapture: (id: number) => capture.add(id), hasPointerCapture: (id: number) => capture.has(id),
    releasePointerCapture: (id: number) => capture.delete(id),
  });
  const input = createNavigationInput(); input.wake = vi.fn(); input.stop = vi.fn();
  const action = vi.fn(), active = vi.fn();
  const detach = attachNavigationInput(canvas as unknown as HTMLCanvasElement, input, new NavigationGestures(), action, active);
  return { canvas, doc, view, input, action, capture, detach };
}
function send(target: EventTarget, name: string, properties: object = {}) {
  const event = Object.assign(new Event(name, { cancelable: true }), properties); target.dispatchEvent(event); return event;
}
it('claims WASD only on focused canvas, preserves shortcuts and releases keys globally', () => {
  const s = setup();
  expect(send(s.canvas, 'keydown', { code: 'KeyW' }).defaultPrevented).toBe(true); expect(s.input.keys.has('KeyW')).toBe(true);
  send(s.view, 'keyup', { code: 'KeyW' }); expect(s.input.keys.size).toBe(0);
  send(s.canvas, 'keydown', { code: 'KeyA', ctrlKey: true }); expect(s.input.keys.size).toBe(0);
  s.doc.activeElement = {}; send(s.canvas, 'keydown', { code: 'KeyD' }); expect(s.input.keys.size).toBe(0);
  s.detach();
});
it('resets held keys and touch vectors on window blur or page hiding', () => {
  const s = setup(); s.input.keys.add('KeyW'); s.input.joystick.y = 1;
  send(s.view, 'blur'); expect(s.input.keys.size).toBe(0); expect(s.input.joystick.y).toBe(0);
  s.input.keys.add('KeyD'); s.doc.hidden = true; send(s.doc, 'visibilitychange'); expect(s.input.keys.size).toBe(0);
  expect(s.input.stop).toHaveBeenCalledTimes(2); s.detach();
});
it('owns one look pointer independently from joystick and ignores taps, then cancels safely', () => {
  const s = setup();
  send(s.canvas, 'pointerdown', { button: 0, pointerId: 2, clientX: 10, clientY: 10 });
  send(s.canvas, 'pointermove', { pointerId: 1, clientX: 100, clientY: 100, pointerType: 'touch' }); expect(s.input.look.x).toBe(0);
  send(s.canvas, 'pointermove', { pointerId: 2, clientX: 12, clientY: 10, pointerType: 'touch' }); expect(s.input.look.x).toBe(0);
  send(s.canvas, 'pointermove', { pointerId: 2, clientX: 32, clientY: 0, pointerType: 'touch' }); expect(s.input.look.x).toBeGreaterThan(0);
  send(s.canvas, 'pointercancel', { pointerId: 2 }); expect(s.capture.size).toBe(0); expect(s.input.look.x).toBe(0); s.detach();
});
it('removes all installed listeners and releases pointer capture on unmount', () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const s = setup(); send(s.canvas, 'pointerdown', { button: 0, pointerId: 7, clientX: 0, clientY: 0 });
    s.detach(); expect(s.canvas.listeners.size + s.doc.listeners.size + s.view.listeners.size).toBe(0); expect(s.capture.size).toBe(0);
    send(s.canvas, 'keydown', { code: 'KeyW' }); expect(s.input.keys.size).toBe(0);
  }
});
it('stops look when focus moves to overlay UI during a drag', () => {
  const s = setup();
  send(s.canvas, 'pointerdown', { button: 0, pointerId: 2, clientX: 0, clientY: 0 });
  send(s.canvas, 'blur');
  send(s.canvas, 'pointermove', { pointerId: 2, clientX: 100, clientY: 100, pointerType: 'mouse' });
  expect(s.input.look.x).toBe(0); expect(s.capture.size).toBe(0); s.detach();
});
