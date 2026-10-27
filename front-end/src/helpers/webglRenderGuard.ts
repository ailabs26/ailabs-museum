import type { WebGLRenderer } from 'three';

/** Native loss can precede webglcontextlost, including during shader compilation.
 * Let the existing recovery owner handle that loss; retain ordinary render errors. */
export function guardWebglRender(renderer: Pick<WebGLRenderer, 'render' | 'getContext'>): () => void {
  const render = renderer.render;
  const guarded: WebGLRenderer['render'] = (scene, camera) => {
    if (renderer.getContext().isContextLost()) return;
    try { render.call(renderer, scene, camera); }
    catch (error) { if (!renderer.getContext().isContextLost()) throw error; }
  };
  renderer.render = guarded;
  return () => { if (renderer.render === guarded) renderer.render = render; };
}
