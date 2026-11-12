import { LoadingManager } from 'three';
import type { BufferGeometry } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import decoderJsUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?url';
import decoderWasmUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url';
import decoderWrapperUrl from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url';
import { disposeModel, validateGlb } from './glbAsset';

const DECODER_URLS = new Map([
  ['draco_decoder.js', decoderJsUrl],
  ['draco_decoder.wasm', decoderWasmUrl],
  ['draco_wasm_wrapper.js', decoderWrapperUrl],
]);
const DECODE_TIMEOUT_MS = 30_000;
const ATTRIBUTE_NAMES: Record<string, string> = {
  POSITION: 'position', NORMAL: 'normal', TANGENT: 'tangent', COLOR_0: 'color',
  TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', TEXCOORD_2: 'uv2', TEXCOORD_3: 'uv3',
  WEIGHTS_0: 'skinWeight', JOINTS_0: 'skinIndex',
};
const ATTRIBUTE_SIZES: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const ATTRIBUTE_ARRAYS: Record<number, string> = {
  5120: 'Int8Array', 5121: 'Uint8Array', 5122: 'Int16Array',
  5123: 'Uint16Array', 5125: 'Uint32Array', 5126: 'Float32Array',
};

interface DracoPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  extensions?: { KHR_draco_mesh_compression?: { attributes: Record<string, number> } };
}

/** Check stream results against their declarations before admitting a decoded model. */
function trackDecodedGeometry(loader: GLTFLoader): () => void {
  const decoded: { geometry: BufferGeometry; primitive: DracoPrimitive }[] = [];
  let modelParser: GLTFParser;
  loader.register(parser => {
    modelParser = parser;
    const loadGeometries = parser.loadGeometries.bind(parser);
    parser.loadGeometries = async primitives => {
      const geometries = await loadGeometries(primitives);
      geometries.forEach((geometry, index) => decoded.push({ geometry, primitive: primitives[index] as DracoPrimitive }));
      return geometries;
    };
    return { name: 'MuseumDecodedGeometryValidation' };
  });
  return () => {
    const buffers = new Set<ArrayBufferLike>();
    let decodedBytes = 0;
    const accessors = modelParser?.json.accessors as { count: number; type: string; componentType: number }[];
    for (const { geometry, primitive } of decoded) {
      for (const attribute of [...Object.values(geometry.attributes), ...(geometry.index ? [geometry.index] : [])]) {
        const array = 'data' in attribute ? attribute.data.array : attribute.array;
        if (!buffers.has(array.buffer)) {
          buffers.add(array.buffer);
          decodedBytes += array.buffer.byteLength;
        }
      }
      if (decodedBytes > 128 * 1024 * 1024) throw new Error('Dữ liệu giải mã mô hình vượt giới hạn.');
      const draco = primitive.extensions?.KHR_draco_mesh_compression;
      if (!draco) continue;
      for (const semantic of Object.keys(draco.attributes)) {
        const accessor = accessors[primitive.attributes[semantic]];
        const attribute = geometry.getAttribute(ATTRIBUTE_NAMES[semantic] ?? semantic.toLowerCase());
        if (!attribute || attribute.count !== accessor.count || attribute.itemSize !== ATTRIBUTE_SIZES[accessor.type]
          || attribute.array.constructor.name !== ATTRIBUTE_ARRAYS[accessor.componentType]) {
          throw new Error('Dữ liệu giải mã Draco khác khai báo mô hình.');
        }
      }
      if (primitive.indices !== undefined && geometry.index?.count !== accessors[primitive.indices].count) {
        throw new Error('Chỉ số giải mã Draco khác khai báo mô hình.');
      }
    }
  };
}

// Three 0.170 exposes this method at runtime, while its declarations omit it.
type RuntimeDracoLoader = DRACOLoader & {
  decodeGeometry(buffer: ArrayBuffer, config: unknown): Promise<BufferGeometry>;
  _initDecoder(): Promise<void>;
};

interface DecoderOwner {
  loader: DRACOLoader;
  parsers: number;
  tasks: number;
  isDisposed: boolean;
}

let decoderOwner: DecoderOwner | undefined;

function releaseDecoder(owner: DecoderOwner) {
  if (owner.parsers || owner.tasks) return;
  owner.isDisposed = true;
  owner.loader.dispose();
  if (decoderOwner === owner) decoderOwner = undefined;
}

function acquireDecoder(): DecoderOwner {
  if (decoderOwner) {
    decoderOwner.parsers++;
    return decoderOwner;
  }
  const manager = new LoadingManager();
  // Decoder resources have a distinct owner from untrusted model resources.
  // Vite emits these installed Three.js files under the configured base URL.
  manager.setURLModifier((resource) => {
    const url = DECODER_URLS.get(resource);
    if (!url) throw new Error('Tài nguyên giải mã không hợp lệ.');
    return url;
  });
  const loader = new DRACOLoader(manager).setWorkerLimit(2) as RuntimeDracoLoader;
  // GLTFLoader calls preload() without observing failures in Three 0.170.
  // Lazy initialization lets the decode promise own missing-resource errors.
  loader.preload = () => loader;
  if (typeof WebAssembly !== 'object') loader.setDecoderConfig({ type: 'js' });
  const owner: DecoderOwner = { loader, parsers: 1, tasks: 0, isDisposed: false };
  const initializeDecoder = loader._initDecoder.bind(loader);
  loader._initDecoder = async () => {
    await initializeDecoder();
    if (owner.isDisposed) {
      loader.dispose();
      throw new Error('Bộ giải mã mô hình đã đóng.');
    }
  };
  const decodeGeometry = loader.decodeGeometry.bind(loader);
  loader.decodeGeometry = (buffer, config) => {
    owner.tasks++;
    // A worker initialization error in Three 0.170 can leave its promise pending.
    // Bound that failure and terminate the cohort after all parser owners finish.
    return new Promise<BufferGeometry>((resolve, reject) => {
      let expired = false;
      const timer = setTimeout(() => {
        expired = true;
        reject(new Error('Không khởi tạo được bộ giải mã mô hình.'));
      }, DECODE_TIMEOUT_MS);
      Promise.resolve().then(() => decodeGeometry(buffer, config)).then((geometry) => {
        if (expired) geometry.dispose();
        else resolve(geometry);
      }, reject).finally(() => clearTimeout(timer));
    }).finally(() => {
      owner.tasks--;
      releaseDecoder(owner);
    });
  };
  decoderOwner = owner;
  return owner;
}

/** Validate before parsing. The caller owns every scene after a successful parse. */
export async function parseSelfContainedGlb(buffer: ArrayBuffer, signal: AbortSignal): Promise<GLTF> {
  signal.throwIfAborted();
  const { usesDraco } = validateGlb(buffer);
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (!url.startsWith('blob:')) throw new Error('Mô hình chứa tài nguyên ngoài tệp.');
    return url;
  });
  const owner = usesDraco ? acquireDecoder() : undefined;
  const loader = new GLTFLoader(manager);
  if (owner) loader.setDRACOLoader(owner.loader);
  const validateDecoded = usesDraco ? trackDecodedGeometry(loader) : undefined;
  try {
    const gltf = await loader.parseAsync(buffer, '');
    try {
      signal.throwIfAborted();
      validateDecoded?.();
    } catch (error) {
      disposeModel(gltf.scenes);
      throw error;
    }
    return gltf;
  } finally {
    if (owner) {
      owner.parsers--;
      releaseDecoder(owner);
    }
  }
}
