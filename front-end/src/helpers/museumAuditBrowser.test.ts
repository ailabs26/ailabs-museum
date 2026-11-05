import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { attachMuseumAudit, auditRecorder, museumAuditApi } from './museumAuditBrowser';

afterEach(() => { if (auditRecorder.isRecording) auditRecorder.stop(performance.now()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('observes only successful renders, propagates errors and removes wrappers/listeners without scheduling work', () => {
  vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 720); vi.stubGlobal('devicePixelRatio', 1);
  const timer = vi.spyOn(globalThis, 'setTimeout');
  const canvas = Object.assign(new EventTarget(), { width: 1280, height: 720 });
  let isLost = false, shouldThrow = false;
  const info = { render: { frame: 0, calls: 3, triangles: 12 }, memory: { geometries: 2, textures: 1 }, programs: [] };
  const render = () => { if (shouldThrow) throw new Error('render failed'); if (!isLost) info.render.frame++; };
  // WebGL is unavailable in the Node unit environment; model only its renderer boundary.
  const renderer = { render, info, domElement: canvas, xr: { isPresenting: false },
    getContext: () => ({ getExtension: () => null, getParameter: () => 'test context', isContextLost: () => isLost }) } as unknown as WebGLRenderer;
  const scene = new Scene(), camera = new PerspectiveCamera();
  const detach = attachMuseumAudit(renderer, () => ({ exhibits: 5 }));
  renderer.render(scene, camera);
  auditRecorder.start({ buildSha: 'a'.repeat(40), device: 'Node logic fixture', conditions: 'no GPU', scenario: 'P03', kind: 'continuous', source: 'fixture', target: 'desktop' }, performance.now(), new Date().toISOString());
  renderer.render(scene, camera);
  expect(auditRecorder.snapshot()!.frames).toHaveLength(1);
  expect(auditRecorder.snapshot()!.resources[0]).toMatchObject({ calls: 3, geometries: 2, textures: 1 });
  isLost = true; canvas.dispatchEvent(new Event('webglcontextlost'));
  renderer.render(scene, camera);
  expect(auditRecorder.snapshot()!.frames).toHaveLength(1);
  isLost = false; shouldThrow = true;
  expect(() => renderer.render(scene, camera)).toThrow('render failed');
  expect(auditRecorder.snapshot()!.events.some(event => event.type === 'render-error')).toBe(true);
  detach(); detach();
  expect(renderer.render).toBe(render);
  canvas.dispatchEvent(new Event('webglcontextlost'));
  expect(auditRecorder.snapshot()!.events.filter(event => event.type === 'context-lost')).toHaveLength(1);
  expect(museumAuditApi.state().attachedRenderers).toBe(0);
  expect(timer).not.toHaveBeenCalled();
});

it('cleanup preserves a newer render owner instead of overwriting its method', () => {
  const canvas = new EventTarget();
  const renderer = { render: () => {}, domElement: canvas,
    getContext: () => ({ getExtension: () => null, getParameter: () => 'test' }) } as unknown as WebGLRenderer;
  const detach = attachMuseumAudit(renderer, () => ({}));
  const newerOwner = () => {};
  renderer.render = newerOwner;
  detach();
  expect(renderer.render).toBe(newerOwner);
  expect(museumAuditApi.state().attachedRenderers).toBe(0);
});
