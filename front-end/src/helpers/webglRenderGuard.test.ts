import { expect, it, vi } from 'vitest';
import { Camera, Scene, type WebGLRenderer } from 'three';
import { guardWebglRender } from './webglRenderGuard';

it('skips frames when native context loss precedes its queued event and resumes after restore', () => {
  let isLost = true;
  const render = vi.fn();
  const renderer = { render, getContext: () => ({ isContextLost: () => isLost }) } as unknown as WebGLRenderer;
  const dispose = guardWebglRender(renderer);
  renderer.render(new Scene(), new Camera()); expect(render).not.toHaveBeenCalled();
  isLost = false;
  renderer.render(new Scene(), new Camera()); expect(render).toHaveBeenCalledOnce();
  dispose(); expect(renderer.render).toBe(render);
});

it('contains a driver loss during shader compilation but rethrows unrelated rendering errors', () => {
  let isLost = false;
  const failure = new Error('shader info log unavailable');
  const render = vi.fn(() => { isLost = true; throw failure; });
  const renderer = { render, getContext: () => ({ isContextLost: () => isLost }) } as unknown as WebGLRenderer;
  guardWebglRender(renderer);
  expect(() => renderer.render(new Scene(), new Camera())).not.toThrow();
  isLost = false; render.mockImplementation(() => { throw failure; });
  expect(() => renderer.render(new Scene(), new Camera())).toThrow(failure);
});
