import { appConfig } from '@/config/env';
import {
  ExpoFileSystemGlbCache,
  type GlbCacheAdapter,
} from '@/features/scene3d/glbCache';
import {
  GlbLoadError,
  computeSha256Hex,
} from '@/features/scene3d/glbLoader';
import {
  MAX_GLB_BYTES,
  publicModelSchema,
  resolvePublicModelUrl,
  type PublicModel,
} from '@/features/scene3d/glbSchema';
import { validateGlb } from '@/features/scene3d/glbValidation';

export interface PreparedArGlbSource {
  localUri: string;
  checksumSha256: string;
  sizeBytes: number;
  source: 'cache' | 'network';
}

export interface PrepareArGlbOptions {
  model: PublicModel;
  apiBaseUrl?: string;
  cache?: GlbCacheAdapter;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  sha256Impl?: (buffer: ArrayBuffer) => Promise<string>;
}

let sharedArCache: GlbCacheAdapter | null = null;
function getDefaultArCache(): GlbCacheAdapter {
  if (!sharedArCache) sharedArCache = new ExpoFileSystemGlbCache();
  return sharedArCache;
}

/**
 * Chuẩn bị tệp GLB cục bộ (`file://...`) cho `Viro3DObject` bằng cách tái dùng lớp cache
 * và thẩm định nhị phân `validateGlb` + SHA-256 của `MOB-E6-02` (MOB-E9-02).
 */
export async function prepareArGlbSource(
  options: PrepareArGlbOptions,
): Promise<PreparedArGlbSource> {
  const parsed = publicModelSchema.safeParse(options.model);
  if (!parsed.success) {
    throw new GlbLoadError('validate_meta', 'format', 'Thông tin mô hình AR không hợp lệ.');
  }
  const model = parsed.data;
  const cache = options.cache ?? getDefaultArCache();
  const sha256Impl = options.sha256Impl ?? computeSha256Hex;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const apiBaseUrl = options.apiBaseUrl ?? appConfig.apiUrl;
  const fullUrl = resolvePublicModelUrl(apiBaseUrl, model.url);

  // Thử đọc lại từ bộ nhớ đệm cục bộ trước.
  const cachedBuffer = await cache.getBuffer(model.checksumSha256);
  if (cachedBuffer) {
    const hash = await sha256Impl(cachedBuffer);
    if (hash === model.checksumSha256 && cachedBuffer.byteLength === model.sizeBytes) {
      validateGlb(cachedBuffer);
      const entry = await cache.putBuffer(model.checksumSha256, cachedBuffer);
      return {
        localUri: entry.uri,
        checksumSha256: model.checksumSha256,
        sizeBytes: entry.sizeBytes,
        source: 'cache',
      };
    }
    await cache.remove(model.checksumSha256);
  }

  if (options.signal?.aborted) {
    throw new GlbLoadError('download', 'aborted', 'Đã hủy tải mô hình AR.');
  }

  const response = await fetchImpl(fullUrl, {
    method: 'GET',
    headers: { Accept: 'model/gltf-binary, application/octet-stream' },
    signal: options.signal,
  });
  if (!response.ok) {
    throw new GlbLoadError(
      'download',
      response.status === 404 ? 'missing' : response.status === 429 ? 'rate_limit' : 'server',
      `Không thể tải mô hình AR (HTTP ${response.status}).`,
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_GLB_BYTES) {
    throw new GlbLoadError('download', 'format', 'Kích thước tệp GLB vượt giới hạn.');
  }
  const actualHash = await sha256Impl(buffer);
  if (actualHash !== model.checksumSha256) {
    throw new GlbLoadError('verify', 'checksum', 'Mã băm SHA-256 của mô hình AR không khớp.');
  }
  validateGlb(buffer);

  const stored = await cache.putBuffer(model.checksumSha256, buffer);
  return {
    localUri: stored.uri,
    checksumSha256: model.checksumSha256,
    sizeBytes: stored.sizeBytes,
    source: 'network',
  };
}
