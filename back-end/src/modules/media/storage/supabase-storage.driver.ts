import { Readable } from 'node:stream';
import { ReadableStream as WebReadableStream } from 'node:stream/web';
import { ByteRange, MediaStorageDriver } from './media-storage-driver';

export interface SupabaseStorageOptions {
  /** Project URL, vd `https://<ref>.supabase.co` (không có dấu / cuối). */
  url: string;
  /** Khóa `service_role` / secret — chỉ dùng ở server, bỏ qua RLS của Storage. */
  serviceKey: string;
  /** Bucket PRIVATE chứa media. */
  bucket: string;
  /** Thời gian chờ tối đa tới khi nhận header phản hồi (ms). */
  timeoutMs?: number;
  /** Cho phép test thay `fetch`. */
  fetchFn?: typeof fetch;
}

/** Thân lỗi của Storage API: `statusCode` là chuỗi, có thể khác HTTP status (vd 400 + "404"). */
interface StorageErrorBody {
  statusCode?: string;
  error?: string;
  message?: string;
}

/**
 * Lưu media trên Supabase Storage qua REST API.
 * - Upload với `x-upsert: false` → Supabase từ chối key đã tồn tại (BR-21).
 * - Bucket private: file chỉ ra ngoài qua `MediaDeliveryController` (giữ kiểm tra published/HMAC).
 */
export class SupabaseStorageDriver implements MediaStorageDriver {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: SupabaseStorageOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const res = await this.request('POST', this.objectUrl(key), {
      'content-type': 'application/octet-stream',
      'x-upsert': 'false',
    }, data);
    if (res.ok) return;
    const body = await readError(res);
    const error = new Error(`Supabase Storage từ chối ghi ${key}: ${res.status} ${body.message ?? ''}`.trim());
    if (res.status === 409 || body.statusCode === '409') (error as NodeJS.ErrnoException).code = 'EEXIST';
    throw error;
  }

  async delete(key: string): Promise<void> {
    const res = await this.request('DELETE', this.objectUrl(key));
    if (res.ok) {
      await res.body?.cancel();
      return;
    }
    const body = await readError(res);
    if (isNotFound(res, body)) return;
    throw new Error(`Supabase Storage không xóa được ${key}: ${res.status} ${body.message ?? ''}`.trim());
  }

  async read(key: string, range?: ByteRange): Promise<Readable | null> {
    const headers: Record<string, string> = range ? { range: `bytes=${range.start}-${range.end}` } : {};
    const res = await this.request('GET', this.objectUrl(key, 'authenticated'), headers);
    if (!res.ok) {
      const body = await readError(res);
      if (isNotFound(res, body)) return null;
      throw new Error(`Supabase Storage không đọc được ${key}: ${res.status} ${body.message ?? ''}`.trim());
    }
    // Đã xin một đoạn byte mà nhận về cả file thì không thể trả 206 đúng nội dung.
    if (range && res.status !== 206) {
      await res.body?.cancel();
      throw new Error(`Supabase Storage bỏ qua Range khi đọc ${key} (status ${res.status})`);
    }
    if (!res.body) return Readable.from([]);
    return Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>);
  }

  private objectUrl(key: string, scope?: 'authenticated'): string {
    const path = key.split('/').map(encodeURIComponent).join('/');
    const segments = ['storage/v1/object', scope, encodeURIComponent(this.options.bucket), path].filter(Boolean);
    return `${this.options.url}/${segments.join('/')}`;
  }

  /** Gọi API với khóa server; hết thời gian chờ header thì hủy (không giới hạn thời gian stream body). */
  private async request(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: Buffer,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFn(url, {
        method,
        headers: {
          apikey: this.options.serviceKey,
          authorization: `Bearer ${this.options.serviceKey}`,
          ...headers,
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readError(res: Response): Promise<StorageErrorBody> {
  try {
    return (await res.json()) as StorageErrorBody;
  } catch {
    return {};
  }
}

function isNotFound(res: Response, body: StorageErrorBody): boolean {
  return res.status === 404 || body.statusCode === '404' || body.error === 'not_found';
}
