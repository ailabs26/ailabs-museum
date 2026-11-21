import * as Crypto from 'expo-crypto';
import { LoadingManager, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { appConfig } from '@/config/env';
import {
  MAX_GLB_BYTES,
  publicModelSchema,
  resolvePublicModelUrl,
  type PublicModel,
} from './glbSchema';
import {
  disposeModel,
  normalizeModel,
  sanitizeModel,
  validateGlb,
  type ModelNormalization,
} from './glbValidation';
import { ExpoFileSystemGlbCache, type GlbCacheAdapter } from './glbCache';

export type GlbLoadStage = 'validate_meta' | 'cache' | 'download' | 'verify' | 'parse' | 'mesh' | 'normalize';
export type GlbErrorCategory =
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'permission'
  | 'missing'
  | 'rate_limit'
  | 'server'
  | 'format'
  | 'checksum'
  | 'mesh'
  | 'unknown';

export class GlbLoadError extends Error {
  constructor(
    readonly stage: GlbLoadStage,
    readonly category: GlbErrorCategory,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GlbLoadError';
  }
}

export interface LoadedGlbAsset {
  modelId: string;
  checksumSha256: string;
  scene: Object3D;
  scenes: Object3D[];
  normalization: ModelNormalization;
  quarantinedMeshCount: number;
  source: 'cache' | 'network';
  sizeBytes: number;
  loadDurationMs: number;
}

export interface LoadGlbOptions {
  model: PublicModel;
  apiBaseUrl?: string;
  cache?: GlbCacheAdapter;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sha256Impl?: (buffer: ArrayBuffer) => Promise<string>;
  onProgress?: (ratio: number) => void;
}

const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Chặn các lời gọi `pixelStorei` không được hỗ trợ trên driver `expo-gl` (iOS/Android)
 * để tránh spam cảnh báo khi `expo-three`/Three.js tải texture trong GLB.
 */
export function configureExpoGlContext(glContext: unknown): void {
  const ctx = glContext as { pixelStorei?: (...args: unknown[]) => void } | null;
  if (!ctx || typeof ctx.pixelStorei !== 'function') return;
  const original = ctx.pixelStorei.bind(ctx);
  const UNSUPPORTED_PARAMS = new Set([
    0x9240, // UNPACK_FLIP_Y_WEBGL
    0x9241, // UNPACK_PREMULTIPLY_ALPHA_WEBGL
    0x9243, // UNPACK_COLORSPACE_CONVERSION_WEBGL
  ]);
  ctx.pixelStorei = (...args: unknown[]) => {
    const [param] = args;
    if (typeof param === 'number' && UNSUPPORTED_PARAMS.has(param)) return;
    original(...args);
  };
}

/** Tính SHA-256 hex (64 ký tự chữ thường) từ ArrayBuffer; dùng WebCrypto nếu có, fallback `expo-crypto`. */
export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const numeric = Number(header.trim());
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const parsedDate = Date.parse(header);
  if (Number.isFinite(parsedDate)) {
    return Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
  }
  return undefined;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new GlbLoadError('download', 'aborted', 'Đã hủy tải mô hình 3D.');
  }
}

async function downloadModelBinary(
  url: string,
  expectedSizeBytes: number,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
  onProgress?: (ratio: number) => void,
): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'model/gltf-binary, application/octet-stream' },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new GlbLoadError('download', 'missing', 'Mô hình 3D không tồn tại hoặc đã bị gỡ.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new GlbLoadError('download', 'permission', 'Không có quyền truy cập mô hình 3D.');
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfterSeconds(response.headers.get('retry-after'));
        throw new GlbLoadError(
          'download',
          'rate_limit',
          'Quá nhiều yêu cầu tải mô hình. Vui lòng thử lại sau.',
          retryAfter,
        );
      }
      if (response.status >= 500) {
        throw new GlbLoadError('download', 'server', 'Máy chủ gặp lỗi khi trả mô hình 3D.');
      }
      throw new GlbLoadError('download', 'unknown', `Tải mô hình thất bại (HTTP ${response.status}).`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const declared = Number(contentLengthHeader);
      if (Number.isFinite(declared) && declared > MAX_GLB_BYTES) {
        throw new GlbLoadError('download', 'format', 'Mô hình vượt quá dung lượng cho phép.');
      }
    }

    onProgress?.(0.35);
    const buffer = await response.arrayBuffer();
    throwIfAborted(signal);

    if (buffer.byteLength <= 0 || buffer.byteLength > MAX_GLB_BYTES) {
      throw new GlbLoadError('download', 'format', 'Dung lượng mô hình tải về không hợp lệ.');
    }
    if (expectedSizeBytes > 0 && buffer.byteLength !== expectedSizeBytes) {
      throw new GlbLoadError(
        'verify',
        'checksum',
        'Kích thước mô hình không khớp khai báo từ máy chủ.',
      );
    }
    onProgress?.(0.75);
    return buffer;
  } catch (error) {
    if (error instanceof GlbLoadError) throw error;
    if (timedOut) {
      throw new GlbLoadError('download', 'timeout', 'Hết thời gian tải mô hình 3D.');
    }
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new GlbLoadError('download', 'aborted', 'Đã hủy tải mô hình 3D.');
    }
    throw new GlbLoadError('download', 'network', 'Không thể kết nối mạng để tải mô hình 3D.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

async function parseSelfContainedGlb(buffer: ArrayBuffer, signal?: AbortSignal): Promise<GLTF> {
  throwIfAborted(signal);
  const manager = new LoadingManager();
  manager.setURLModifier((resourceUrl) => {
    if (!resourceUrl.startsWith('blob:') && !resourceUrl.startsWith('data:')) {
      throw new Error('Mô hình chứa tài nguyên ngoài tệp.');
    }
    return resourceUrl;
  });

  const loader = new GLTFLoader(manager);
  const gltf = await loader.parseAsync(buffer, '');
  if (signal?.aborted) {
    disposeModel(gltf.scenes);
    throw new GlbLoadError('parse', 'aborted', 'Đã hủy giải mã mô hình 3D.');
  }
  return gltf;
}

let defaultCacheInstance: GlbCacheAdapter | null = null;
function getDefaultGlbCache(): GlbCacheAdapter {
  if (!defaultCacheInstance) {
    defaultCacheInstance = new ExpoFileSystemGlbCache();
  }
  return defaultCacheInstance;
}

/**
 * Pipeline tải 1 hiện vật GLB có cache cục bộ (MOB-E6-02):
 * 1. Validate metadata bằng Zod (`publicModelSchema`) và ghép origin API an toàn.
 * 2. Thử đọc từ cache cục bộ theo `checksumSha256`; nếu file cache bị hỏng/sai hash -> tự xóa & tải lại.
 * 3. Nếu chưa có trong cache -> tải qua HTTP (timeout + abort + phân loại lỗi 404/429/5xx), kiểm SHA-256 & `validateGlb`, lưu cache.
 * 4. Giải mã tự chứa bằng `GLTFLoader`, lọc mesh (`sanitizeModel`), chuẩn hóa kích thước (`normalizeModel`).
 * 5. Giải phóng tài nguyên GPU ngay nếu hủy giữa chừng hoặc lỗi bước sau parse.
 */
export async function loadGlbModel(options: LoadGlbOptions): Promise<LoadedGlbAsset> {
  const startedAt = Date.now();
  const parsedModel = publicModelSchema.safeParse(options.model);
  if (!parsedModel.success) {
    throw new GlbLoadError('validate_meta', 'format', 'Thông tin mô hình GLB không hợp lệ.');
  }
  const model = parsedModel.data;
  const cache = options.cache ?? getDefaultGlbCache();
  const sha256Impl = options.sha256Impl ?? computeSha256Hex;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const apiBaseUrl = options.apiBaseUrl ?? appConfig.apiUrl;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let resolvedUrl: string;
  try {
    resolvedUrl = resolvePublicModelUrl(apiBaseUrl, model.url);
  } catch (error) {
    throw new GlbLoadError(
      'validate_meta',
      'format',
      error instanceof Error ? error.message : 'URL mô hình không hợp lệ.',
    );
  }

  options.onProgress?.(0.05);
  let buffer: ArrayBuffer | null = null;
  let source: 'cache' | 'network' = 'cache';

  // Bước 1: Kiểm tra bộ nhớ đệm cục bộ.
  try {
    const cached = await cache.getBuffer(model.checksumSha256);
    if (cached) {
      const actualHash = await sha256Impl(cached);
      if (actualHash === model.checksumSha256 && cached.byteLength === model.sizeBytes) {
        validateGlb(cached);
        buffer = cached;
        source = 'cache';
        options.onProgress?.(0.75);
      } else {
        // File cache hỏng hoặc bị sửa đổi -> dọn sạch để tải lại từ máy chủ.
        await cache.remove(model.checksumSha256);
      }
    }
  } catch {
    await cache.remove(model.checksumSha256).catch(() => {});
    buffer = null;
  }

  // Bước 2: Cache miss -> tải từ API và thẩm định nhị phân.
  if (!buffer) {
    source = 'network';
    const downloaded = await downloadModelBinary(
      resolvedUrl,
      model.sizeBytes,
      timeoutMs,
      fetchImpl,
      options.signal,
      options.onProgress,
    );

    const actualHash = await sha256Impl(downloaded);
    if (actualHash !== model.checksumSha256) {
      throw new GlbLoadError('verify', 'checksum', 'Mã băm SHA-256 của mô hình GLB không khớp.');
    }

    try {
      validateGlb(downloaded);
    } catch {
      throw new GlbLoadError('verify', 'format', 'Tệp GLB không hợp lệ hoặc chứa tài nguyên ngoài.');
    }

    // Lưu vào cache không chặn luồng nếu ổ đĩa đầy.
    await cache.putBuffer(model.checksumSha256, downloaded).catch(() => {});
    buffer = downloaded;
  }

  throwIfAborted(options.signal);
  options.onProgress?.(0.85);

  // Bước 3: Giải mã GLB tự chứa bằng GLTFLoader.
  let gltf: GLTF;
  try {
    gltf = await parseSelfContainedGlb(buffer, options.signal);
  } catch (error) {
    if (error instanceof GlbLoadError) throw error;
    throw new GlbLoadError('parse', 'format', 'Không thể giải mã hình học từ tệp GLB.');
  }

  const ownedScenes: Object3D[] = [...gltf.scenes];
  let stage: GlbLoadStage = 'mesh';
  try {
    throwIfAborted(options.signal);
    const { quarantined } = sanitizeModel(gltf.scene);
    ownedScenes.push(...quarantined);
    stage = 'normalize';
    const normalization = normalizeModel(gltf.scene);
    options.onProgress?.(1);
    return {
      modelId: model.id,
      checksumSha256: model.checksumSha256,
      scene: gltf.scene,
      scenes: ownedScenes,
      normalization,
      quarantinedMeshCount: quarantined.length,
      source,
      sizeBytes: buffer.byteLength,
      loadDurationMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    disposeModel(ownedScenes);
    if (error instanceof GlbLoadError) throw error;
    throw new GlbLoadError(
      stage,
      stage === 'mesh' ? 'mesh' : 'format',
      error instanceof Error ? error.message : 'Mô hình 3D không đạt chuẩn hiển thị.',
    );
  }
}
