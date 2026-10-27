import { expect, type Page } from '@playwright/test';
import type { Camera, Object3D, WebGLRenderer, Mesh, Sprite } from 'three';

interface ObservedRenderer {
  renderer: WeakRef<WebGLRenderer>;
  scene?: WeakRef<Object3D>;
  camera?: WeakRef<Camera>;
  frames: number;
  times: number[];
}
declare global {
  interface Window { museumProbe: ObservedRenderer[] }
}

/** Test-only Three devtools observer. Weak references do not retain old scenes. */
export async function installRendererProbe(page: Page) {
  await page.addInitScript(() => {
    window.museumProbe = [];
    const devtools = new EventTarget();
    Reflect.set(window, '__THREE_DEVTOOLS__', devtools);
    devtools.addEventListener('observe', (event) => {
      const renderer = (event as CustomEvent).detail as WebGLRenderer;
      if (!renderer.isWebGLRenderer) return;
      const record: ObservedRenderer = { renderer: new WeakRef(renderer), frames: 0, times: [] };
      window.museumProbe.push(record);
      const render = renderer.render;
      renderer.render = function (scene, camera) {
        render.call(this, scene, camera);
        record.scene = new WeakRef(scene);
        record.camera = new WeakRef(camera);
        record.frames++;
        record.times.push(performance.now());
        if (record.times.length > 300) record.times.shift();
      };
    });
  });
}

export async function readRendererProbe(page: Page) {
  return page.evaluate(() => window.museumProbe.map((record) => {
    const renderer = record.renderer.deref();
    const scene = record.scene?.deref();
    const materials = new Set<number>();
    const labels: Record<string, number> = {};
    let objects = 0;
    scene?.traverse((object) => {
      objects++;
      const material = (object as Mesh).material;
      if (material) for (const item of Array.isArray(material) ? material : [material]) materials.add(item.id);
      if ((object as Sprite).isSprite) {
        const map = (object as Sprite).material.map;
        if (map) labels[object.uuid] = map.id;
      }
    });
    return {
      live: !!renderer && !renderer.getContext().isContextLost(),
      frames: record.frames,
      times: record.times,
      calls: renderer?.info.render.calls ?? 0,
      triangles: renderer?.info.render.triangles ?? 0,
      geometries: renderer?.info.memory.geometries ?? 0,
      textures: renderer?.info.memory.textures ?? 0,
      materials: materials.size,
      objects,
      labels,
    };
  }));
}

/** Texture assignment happens after image decode; do not measure half-loaded rooms. */
export async function waitForGallerySurfaces(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const maps = new Set<string>();
    window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => {
      const material = (object as Mesh).material;
      for (const item of !material ? [] : Array.isArray(material) ? material : [material]) {
        const surface = item as import('three').MeshStandardMaterial;
        for (const map of [surface.map, surface.normalMap, surface.roughnessMap]) {
          if (map?.name && map.image?.width === 512) maps.add(map.uuid);
        }
      }
    });
    return maps.size;
  })).toBe(8);
}

export async function waitForRendererIdle(page: Page) {
  await expect(async () => {
    const frames = (await readRendererProbe(page)).at(-1)!.frames;
    await page.waitForTimeout(1000); // Longer than a software renderer's active frame interval.
    expect((await readRendererProbe(page)).at(-1)!.frames).toBe(frames);
  }).toPass({ timeout: 10_000, intervals: [100, 200] });
}
