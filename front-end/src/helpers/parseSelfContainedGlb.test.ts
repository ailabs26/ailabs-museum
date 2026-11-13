import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import type { LoadingManager } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { parseSelfContainedGlb } from './parseSelfContainedGlb';
import { disposeModel } from './glbAsset';

const signal = () => new AbortController().signal;
const runtimePrototype = DRACOLoader.prototype as DRACOLoader & {
  decodeGeometry(buffer: ArrayBuffer, config: unknown): Promise<BufferGeometry>;
  _loadLibrary(url: string, responseType: string): Promise<unknown>;
  _initDecoder(): Promise<void>;
};

function fixture(draco = false) {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const data = JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    extensionsUsed: draco ? ['KHR_draco_mesh_compression'] : [],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 },
      ...(draco ? { extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: { POSITION: 0 } } } } : {}) }] }],
    buffers: [{ byteLength: positions.byteLength }], bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    accessors: [{ ...(draco ? {} : { bufferView: 0 }), componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  });
  const text = new TextEncoder().encode(data);
  const size = Math.ceil(text.length / 4) * 4;
  const buffer = new ArrayBuffer(28 + size + positions.byteLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, size, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, size).fill(32); new Uint8Array(buffer, 20, text.byteLength).set(text);
  view.setUint32(20 + size, positions.byteLength, true); view.setUint32(24 + size, 0x004e4942, true);
  new Uint8Array(buffer, 28 + size).set(new Uint8Array(positions.buffer));
  return buffer;
}

function parsed(): GLTF {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  return { scene, scenes: [scene] } as unknown as GLTF;
}

interface FixtureJson {
  accessors: Record<string, unknown>[];
  meshes: { primitives: Record<string, unknown>[] }[];
  nodes: Record<string, unknown>[];
  extensionsUsed: string[];
}

function changeJson(buffer: ArrayBuffer, change: (json: FixtureJson) => void): ArrayBuffer {
  const view = new DataView(buffer);
  const previousLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, previousLength))) as FixtureJson;
  change(json);
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const length = Math.ceil(encoded.byteLength / 4) * 4;
  const result = new ArrayBuffer(buffer.byteLength + length - previousLength);
  new Uint8Array(result, 0, 20).set(new Uint8Array(buffer, 0, 20));
  new Uint8Array(result, 20, length).fill(32);
  new Uint8Array(result, 20, encoded.byteLength).set(encoded);
  new Uint8Array(result, 20 + length).set(new Uint8Array(buffer, 20 + previousLength));
  new DataView(result).setUint32(8, result.byteLength, true);
  new DataView(result).setUint32(12, length, true);
  return result;
}

function decodedTriangle(): BufferGeometry {
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)).setIndex([0, 1, 2]);
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.useRealTimers());

it('genuinely parses legacy embedded geometry without creating a decoder', async () => {
  const attach = vi.spyOn(GLTFLoader.prototype, 'setDRACOLoader');
  const result = await parseSelfContainedGlb(fixture(), signal());
  const mesh = result.scene.children[0] as Mesh;
  expect(mesh.geometry.getAttribute('position').count).toBe(3);
  expect(attach).not.toHaveBeenCalled();
  disposeModel(result.scenes);
});

it('admits matching Draco geometry through the real parser', async () => {
  const geometry = decodedTriangle();
  vi.spyOn(runtimePrototype, 'decodeGeometry').mockResolvedValue(geometry);
  const result = await parseSelfContainedGlb(fixture(true), signal());
  expect((result.scene.children[0] as Mesh).geometry).toBe(geometry);
  disposeModel(result.scenes);
});

it.each(['position count', 'index count', 'instanced position count'])('rejects a decoded %s that differs from the declarations and disposes its scene', async kind => {
  const geometry = decodedTriangle();
  const dispose = vi.spyOn(geometry, 'dispose');
  vi.spyOn(runtimePrototype, 'decodeGeometry').mockResolvedValue(geometry);
  const buffer = changeJson(fixture(true), json => {
    if (kind === 'index count') {
      json.accessors.push({ componentType: 5123, type: 'SCALAR', count: 6 });
      json.meshes[0].primitives[0].indices = 1;
    } else {
      json.accessors[0].count = 1;
    }
    if (kind === 'instanced position count') {
      json.extensionsUsed.push('EXT_mesh_gpu_instancing');
      json.accessors.push({ bufferView: 0, componentType: 5126, type: 'VEC3', count: 1 });
      json.nodes[0].extensions = { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 1 } } };
    }
  });
  await expect(parseSelfContainedGlb(buffer, signal())).rejects.toThrow('Draco');
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('shares a bounded decoder between overlapping parses and disposes once both finish', async () => {
  let finishFirst!: (value: GLTF) => void;
  let finishSecond!: (value: GLTF) => void;
  const loaders: DRACOLoader[] = [];
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(function (this: GLTFLoader) {
    loaders.push(this.dracoLoader!);
    return new Promise(resolve => {
      if (loaders.length === 1) finishFirst = resolve;
      else finishSecond = resolve;
    });
  });
  const dispose = vi.spyOn(DRACOLoader.prototype, 'dispose');
  const workerLimit = vi.spyOn(DRACOLoader.prototype, 'setWorkerLimit');
  const first = parseSelfContainedGlb(fixture(true), signal());
  const second = parseSelfContainedGlb(fixture(true), signal());
  expect(loaders[0]).toBe(loaders[1]);
  expect(workerLimit).toHaveBeenCalledWith(2);
  finishFirst(parsed()); disposeModel((await first).scenes);
  expect(dispose).not.toHaveBeenCalled();
  finishSecond(parsed()); disposeModel((await second).scenes);
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('allowlists only bundled decoder resources on a dedicated manager', async () => {
  let decoderManager!: LoadingManager;
  let modelManager!: LoadingManager;
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async function (this: GLTFLoader) {
    decoderManager = this.dracoLoader!.manager;
    modelManager = this.manager;
    return parsed();
  });
  const result = await parseSelfContainedGlb(fixture(true), signal());
  expect(decoderManager).not.toBe(modelManager);
  expect(decoderManager.resolveURL('draco_decoder.wasm')).toContain('draco_decoder');
  expect(() => decoderManager.resolveURL('https://example.com/draco_decoder.wasm')).toThrow();
  expect(() => decoderManager.resolveURL('other.wasm')).toThrow();
  expect(() => modelManager.resolveURL('draco_decoder.wasm')).toThrow();
  expect(modelManager.resolveURL('blob:embedded-texture')).toBe('blob:embedded-texture');
  disposeModel(result.scenes);
});

it('selects the bundled JS decoder when WebAssembly is unavailable', async () => {
  vi.stubGlobal('WebAssembly', undefined);
  const configure = vi.spyOn(DRACOLoader.prototype, 'setDecoderConfig');
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue(parsed());
  try {
    const result = await parseSelfContainedGlb(fixture(true), signal());
    expect(configure).toHaveBeenCalledWith({ type: 'js' });
    disposeModel(result.scenes);
  } finally { vi.unstubAllGlobals(); }
});

it('propagates missing decoder resources through the real parser without unhandled preload rejections', async () => {
  const dispose = vi.spyOn(DRACOLoader.prototype, 'dispose');
  const library = vi.spyOn(runtimePrototype, '_loadLibrary').mockRejectedValue(new Error('HTTP 404'));
  await expect(parseSelfContainedGlb(fixture(true), signal())).rejects.toThrow('404');
  expect(library).toHaveBeenCalledWith('draco_wasm_wrapper.js', 'text');
  expect(library).toHaveBeenCalledWith('draco_decoder.wasm', 'arraybuffer');
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('propagates corrupt stream failures, releasing workers for a later retry', async () => {
  const dispose = vi.spyOn(DRACOLoader.prototype, 'dispose');
  vi.spyOn(runtimePrototype, 'decodeGeometry').mockRejectedValue(new Error('corrupt Draco stream'));
  await expect(parseSelfContainedGlb(fixture(true), signal())).rejects.toThrow();
  expect(dispose).toHaveBeenCalledTimes(1);
  vi.mocked(runtimePrototype.decodeGeometry).mockRejectedValue(new Error('corrupt Draco stream'));
  await expect(parseSelfContainedGlb(fixture(true), signal())).rejects.toThrow();
  expect(dispose).toHaveBeenCalledTimes(2);
});

it('bounds a decoder worker initialization failure and disposes its late geometry', async () => {
  vi.useFakeTimers();
  let finish!: (geometry: BufferGeometry) => void;
  vi.spyOn(runtimePrototype, 'decodeGeometry').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const disposeDecoder = vi.spyOn(DRACOLoader.prototype, 'dispose');
  const loading = parseSelfContainedGlb(fixture(true), signal());
  const failure = expect(loading).rejects.toThrow('giải mã');
  await vi.advanceTimersByTimeAsync(30_000);
  await failure;
  expect(disposeDecoder).toHaveBeenCalledTimes(1);
  const geometry = new BoxGeometry(); const dispose = vi.spyOn(geometry, 'dispose');
  finish(geometry);
  await vi.advanceTimersByTimeAsync(0);
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('prevents worker creation if decoder resources finish loading after the owner timed out', async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  vi.spyOn(runtimePrototype, '_initDecoder').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const dispose = vi.spyOn(DRACOLoader.prototype, 'dispose');
  const worker = vi.fn(); vi.stubGlobal('Worker', worker);
  try {
    const loading = parseSelfContainedGlb(fixture(true), signal());
    const failure = expect(loading).rejects.toThrow('giải mã');
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(worker).not.toHaveBeenCalled();
    // A second disposal also releases a blob created by late initialization.
    expect(dispose).toHaveBeenCalledTimes(2);
  } finally { vi.unstubAllGlobals(); }
});

it('disposes decoded scenes on abort and rejects before creating a decoder for pre-abort', async () => {
  const controller = new AbortController();
  const result = parsed(); const mesh = result.scene.children[0] as Mesh;
  const dispose = vi.spyOn(mesh.geometry, 'dispose');
  const attach = vi.spyOn(GLTFLoader.prototype, 'setDRACOLoader');
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async () => { controller.abort(); return result; });
  await expect(parseSelfContainedGlb(fixture(true), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(attach).toHaveBeenCalledTimes(1);
  await expect(parseSelfContainedGlb(fixture(true), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(attach).toHaveBeenCalledTimes(1);
});
