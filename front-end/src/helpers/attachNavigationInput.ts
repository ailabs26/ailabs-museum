import type { NavigationInput } from './museumNavigation';
import { NAVIGATION } from './museumNavigation';
import type { NavigationGestures } from './navigationGestures';

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
const ACTION_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'reset', KeyF: 'focus', Equal: 'in', NumpadAdd: 'in', Minus: 'out', NumpadSubtract: 'out' } as const;
export type NavigationAction = typeof ACTION_KEYS[keyof typeof ACTION_KEYS];

/** Only the focused canvas consumes keyboard input; global listeners only release it. */
export function attachNavigationInput(canvas: HTMLCanvasElement, input: NavigationInput, gestures: NavigationGestures,
  onAction: (action: NavigationAction) => void, onActive: (isActive: boolean) => void): () => void {
  const doc = canvas.ownerDocument, view = doc.defaultView!;
  let pointer: { id: number; x: number; y: number; startX: number; startY: number; dragged: boolean } | null = null;
  const releasePointer = () => {
    const id = pointer?.id;
    pointer = null;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  };
  const clear = () => {
    input.keys.clear(); input.joystick.x = input.joystick.y = input.look.x = input.look.y = 0;
    input.stop(); releasePointer(); gestures.cancel(); onActive(false);
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || doc.activeElement !== canvas) return;
    if (MOVEMENT_KEYS.has(event.code)) {
      event.preventDefault(); input.keys.add(event.code); input.wake();
    } else {
      const action = ACTION_KEYS[event.code as keyof typeof ACTION_KEYS];
      if (action) { event.preventDefault(); onAction(action); }
    }
  };
  const keyup = (event: KeyboardEvent) => { if (input.keys.delete(event.code)) input.invalidate(); };
  const pointerdown = (event: PointerEvent) => {
    if (event.button !== 0 || pointer) return;
    canvas.focus({ preventScroll: true }); onActive(true);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false };
    canvas.setPointerCapture(event.pointerId);
  };
  const pointermove = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5) pointer.dragged = true;
    if (pointer.dragged) {
      const sensitivity = event.pointerType === 'touch' ? NAVIGATION.touchSensitivity : NAVIGATION.mouseSensitivity;
      input.look.x += (event.clientX - pointer.x) * sensitivity;
      input.look.y += (event.clientY - pointer.y) * sensitivity;
      input.wake();
    }
    pointer.x = event.clientX; pointer.y = event.clientY;
  };
  const pointerup = (event: PointerEvent) => {
    gestures.end(event.pointerId);
    if (pointer?.id === event.pointerId) releasePointer();
  };
  const pointercancel = (event: PointerEvent) => {
    gestures.cancel();
    if (pointer?.id === event.pointerId) { input.look.x = input.look.y = 0; releasePointer(); input.stop(); }
  };
  const lostCapture = (event: PointerEvent) => { if (pointer?.id === event.pointerId) { pointer = null; input.look.x = input.look.y = 0; gestures.cancel(); } };
  const focus = () => onActive(true);
  const blur = () => { input.keys.clear(); input.look.x = input.look.y = 0; input.stop(); releasePointer(); gestures.cancel(); onActive(false); };
  const visibility = () => { if (doc.hidden) clear(); };
  const wheel = (event: WheelEvent) => { event.preventDefault(); onAction(event.deltaY < 0 ? 'in' : 'out'); };
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Phòng trưng bày 3D');
  canvas.setAttribute('aria-describedby', 'museum-controls-help');
  canvas.style.touchAction = 'none';
  canvas.addEventListener('keydown', keydown); view.addEventListener('keyup', keyup);
  canvas.addEventListener('pointerdown', pointerdown); canvas.addEventListener('pointermove', pointermove);
  view.addEventListener('pointerup', pointerup); canvas.addEventListener('pointercancel', pointercancel);
  canvas.addEventListener('lostpointercapture', lostCapture);
  canvas.addEventListener('focus', focus); canvas.addEventListener('blur', blur);
  canvas.addEventListener('wheel', wheel, { passive: false });
  view.addEventListener('blur', clear); doc.addEventListener('visibilitychange', visibility);
  canvas.focus({ preventScroll: true });
  return () => {
    clear();
    canvas.removeEventListener('keydown', keydown); view.removeEventListener('keyup', keyup);
    canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointermove', pointermove);
    view.removeEventListener('pointerup', pointerup); canvas.removeEventListener('pointercancel', pointercancel);
    canvas.removeEventListener('lostpointercapture', lostCapture);
    canvas.removeEventListener('focus', focus); canvas.removeEventListener('blur', blur);
    canvas.removeEventListener('wheel', wheel); view.removeEventListener('blur', clear);
    doc.removeEventListener('visibilitychange', visibility);
  };
}
