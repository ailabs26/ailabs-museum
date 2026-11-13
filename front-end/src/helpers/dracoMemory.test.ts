import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { parseSelfContainedGlb } from './parseSelfContainedGlb';
import { limitDracoDecoderSource, limitDracoWasmMemory } from './dracoMemory';

const HEAP_LIMIT = 128 * 1024 * 1024;
const prototype = DRACOLoader.prototype as DRACOLoader & {
  _loadLibrary(url: string, responseType: string): Promise<unknown>;
  _initDecoder(): Promise<void>;
  decoderConfig: { wasmBinary?: ArrayBuffer };
};

function fixture(): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' },
    extensionsUsed: ['KHR_draco_mesh_compression'], buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteLength: 4 }],
    accessors: [{ componentType: 5126, count: 1, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 },
      extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: { POSITION: 0 } } } }] }],
  }));
  const size = Math.ceil(json.length / 4) * 4;
  const buffer = new ArrayBuffer(size + 32);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, size, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, size).fill(32); new Uint8Array(buffer, 20, json.length).set(json);
  view.setUint32(size + 20, 4, true); view.setUint32(size + 24, 0x004e4942, true);
  return buffer;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('caps the actual WASM engine memory before a stream can grow its heap', async () => {
  const original = await readFile('node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm');
  vi.spyOn(prototype, '_loadLibrary').mockImplementation(async (_url, type) =>
    type === 'arraybuffer' ? original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength) : '');
  let binary!: ArrayBuffer;
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async function (this: GLTFLoader) {
    const decoder = this.dracoLoader as typeof prototype;
    await decoder._initDecoder();
    binary = decoder.decoderConfig.wasmBinary!;
    const scene = new Group();
    return { scene, scenes: [scene] } as unknown as GLTF;
  });
  await parseSelfContainedGlb(fixture(), new AbortController().signal);
  const module = new WebAssembly.Module(binary);
  const imports: WebAssembly.Imports = {};
  for (const entry of WebAssembly.Module.imports(module)) {
    imports[entry.module] ??= {};
    imports[entry.module][entry.name] = () => 0;
  }
  const instance = new WebAssembly.Instance(module, imports);
  const memory = Object.values(instance.exports).find(value => value instanceof WebAssembly.Memory) as WebAssembly.Memory;
  expect(memory).toBeDefined();
  const pagesToExceedLimit = (HEAP_LIMIT - memory.buffer.byteLength) / 65536 + 1;
  expect(() => memory.grow(pagesToExceedLimit)).toThrow(RangeError);
  expect(memory.buffer.byteLength).toBeLessThanOrEqual(HEAP_LIMIT);
});

it('bounds the JS fallback heap and cumulative output allocations inside the worker', async () => {
  vi.stubGlobal('WebAssembly', undefined);
  const fakeDecoder = `function DracoDecoderModule(config) {
    globalThis.receivedConfig = config;
    function Decoder() {}
    Decoder.prototype.DecodeArrayToMesh = function () {};
    Decoder.prototype.DecodeArrayToPointCloud = function () {};
    var module = { Decoder: Decoder, _malloc: function () { return 8; } };
    globalThis.testModule = module;
    config.onModuleLoaded(module);
  }`;
  vi.spyOn(prototype, '_loadLibrary').mockResolvedValue(fakeDecoder);
  let workerBlob!: Blob;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { workerBlob = blob as Blob; return 'blob:memory-test'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async function (this: GLTFLoader) {
    await (this.dracoLoader as typeof prototype)._initDecoder();
    const scene = new Group();
    return { scene, scenes: [scene] } as unknown as GLTF;
  });
  await parseSelfContainedGlb(fixture(), new AbortController().signal);
  const context: Record<string, unknown> = { console };
  context.self = context;
  runInNewContext(await workerBlob.text(), context);
  const onmessage = context.onmessage as (event: { data: unknown }) => void;
  onmessage({ data: { type: 'init', decoderConfig: { type: 'js' } } });
  const config = context.receivedConfig as { wasmMemory: { buffer: ArrayBuffer; grow(pages: number): number } };
  expect(config.wasmMemory).toBeDefined();
  expect(config.wasmMemory.buffer.byteLength).toBe(HEAP_LIMIT);
  expect(() => config.wasmMemory.grow(1)).toThrow();
  const module = context.testModule as { Decoder: new () => { DecodeArrayToMesh(): void }; _malloc(bytes: number): number };
  new module.Decoder().DecodeArrayToMesh();
  expect(module._malloc(HEAP_LIMIT / 2)).toBe(8);
  expect(module._malloc(HEAP_LIMIT / 2)).toBe(8);
  expect(() => module._malloc(1)).toThrow();
  new module.Decoder().DecodeArrayToMesh();
  expect(module._malloc(1)).toBe(8);
});

it.each(['wasm', 'js'])('enforces allocation limits with the actual %s decoder module', async type => {
  const file = type === 'js' ? 'draco_decoder.js' : 'draco_wasm_wrapper.js';
  const source = await readFile(`node_modules/three/examples/jsm/libs/draco/gltf/${file}`, 'utf8');
  const context: Record<string, unknown> = { console, WebAssembly, TextDecoder, setTimeout, clearTimeout };
  runInNewContext(limitDracoDecoderSource(source, type === 'js'), context);
  const factory = context.DracoDecoderModule as (config: Record<string, unknown>) => unknown;
  const original = await readFile('node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm');
  const binary = original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength);
  const module = await new Promise<{ HEAP8: Int8Array; _malloc(bytes: number): number }>((resolve, reject) => {
    factory({ wasmBinary: limitDracoWasmMemory(binary), onModuleLoaded: resolve, onAbort: reject });
  });
  expect(module.HEAP8.byteLength).toBeLessThanOrEqual(HEAP_LIMIT);
  expect(() => module._malloc(HEAP_LIMIT + 1)).toThrow('output');
  expect(module.HEAP8.byteLength).toBeLessThanOrEqual(HEAP_LIMIT);
});

it('fails closed when the installed decoder memory layout changes', async () => {
  const original = await readFile('node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm');
  const memoryOffset = original.indexOf(Buffer.from([1, 1, 128, 2, 128, 128, 2]));
  expect(memoryOffset).toBeGreaterThan(8);
  original[memoryOffset] = 2;
  const binary = original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength);
  expect(() => limitDracoWasmMemory(binary)).toThrow('layout');
});
