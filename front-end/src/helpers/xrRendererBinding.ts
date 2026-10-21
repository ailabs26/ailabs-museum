import type { WebGLRenderer } from 'three';

/** Three r170 assumes its private animation context exists in its end handler.
 * A native end during setSession's awaits violates that assumption. Defer the
 * event until binding completes; a rejected partial bind must retire Canvas.
 * This adapter owns no animation loop and never changes runtime tracking. */
export async function bindXrRenderer(renderer: WebGLRenderer, session: XRSession, onInvalidRenderer: () => void) {
  // Observe preflight end without suppressing the lifecycle owner's cleanup.
  let preflightEnded = false;
  const endPreflight = () => { preflightEnded = true; };
  session.addEventListener('end', endPreflight);
  try { await renderer.getContext().makeXRCompatible(); }
  finally { session.removeEventListener('end', endPreflight); }
  if (preflightEnded) throw new Error('XR session ended before renderer initialization');
  let binding = true, invalid = false, ended = false;
  const deferEnd = (event: Event) => {
    if (!binding && !invalid) return;
    event.stopImmediatePropagation(); ended = true;
    // A failed manager is discarded, never reused. Its only remaining event
    // must not invoke native partial cleanup; the ended session is GC-able.
    if (invalid) session.removeEventListener('end', deferEnd, true);
  };
  session.addEventListener('end', deferEnd, true);
  try { await renderer.xr.setSession(session); }
  catch (error) {
    invalid = true; binding = false;
    if (ended) session.removeEventListener('end', deferEnd, true);
    onInvalidRenderer();
    throw error;
  }
  binding = false;
  session.removeEventListener('end', deferEnd, true);
  if (ended) {
    // Delivery occurs once to the ordinary listeners, after the official
    // manager has an animation context and can restore its framebuffer safely.
    session.dispatchEvent(new Event('end'));
    throw new Error('XR session ended during renderer initialization');
  }
}
