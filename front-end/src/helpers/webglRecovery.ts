export type WebglStatus = 'ready' | 'recovering' | 'verifying' | 'failed';

/** Canvas stays mounted so the browser/Three can restore its existing context.
 * A restored event alone is insufficient: the integration must prove a frame. */
export function watchWebglRecovery(canvas: EventTarget, onChange: (status: WebglStatus) => void) {
  let status: WebglStatus = 'ready', losses = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = (next: WebglStatus) => { status = next; onChange(next); };
  const lost = (event: Event) => {
    event.preventDefault();
    if (status !== 'ready') return;
    if (++losses > 2) { update('failed'); return; }
    update('recovering');
    timer = setTimeout(() => update('failed'), 8000);
  };
  const restored = () => { if (status === 'recovering') update('verifying'); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return {
    frameRendered() {
      if (status !== 'verifying') return;
      clearTimeout(timer); update('ready');
    },
    dispose() {
      clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    },
  };
}
