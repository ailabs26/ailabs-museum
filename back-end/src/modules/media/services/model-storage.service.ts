import { BadGatewayException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { isSafeModelKey, MAX_MODEL_BYTES } from '../dto/public-model.dto';

@Injectable()
export class ModelStorageService {
  constructor(private readonly config: ConfigService) {}

  async open(key: string, expectedBytes: number, signal?: AbortSignal) {
    if (!isSafeModelKey(key) || expectedBytes <= 0 || expectedBytes > MAX_MODEL_BYTES) throw new NotFoundException('Mô hình không khả dụng.');
    const base = this.config.get<string>('SUPABASE_URL');
    const secret = this.config.get<string>('SUPABASE_SECRET_KEY') || this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET');
    if (!base || !secret || !bucket || !/^[a-zA-Z0-9_-]+$/.test(bucket)) {
      throw new ServiceUnavailableException('Chưa cấu hình kho mô hình trên máy chủ.');
    }
    const timeout = AbortSignal.timeout(90_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const path = `${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
    try {
      const signed = await fetch(new URL(`/storage/v1/object/sign/${path}`, base), {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 120 }), signal: requestSignal, redirect: 'error',
      });
      if (!signed.ok) { await signed.body?.cancel(); throw new Error('sign failed'); }
      const data: unknown = await signed.json();
      if (!data || typeof data !== 'object' || !('signedURL' in data) || typeof data.signedURL !== 'string') throw new Error('invalid sign response');
      const url = new URL(`/storage/v1${data.signedURL}`, base);
      if (url.origin !== new URL(base).origin || url.pathname !== `/storage/v1/object/sign/${path}`) throw new Error('invalid sign path');
      const response = await fetch(url, { headers, signal: requestSignal, redirect: 'error' });
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) !== expectedBytes) {
        await response.body?.cancel(); throw new Error('download failed');
      }
      const upstream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      let bytes = 0;
      const stream = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          callback(bytes > expectedBytes ? new Error('Model size exceeded') : null, chunk);
        },
        flush(callback) { callback(bytes === expectedBytes ? null : new Error('Incomplete model')); },
        destroy(error, callback) { upstream.destroy(); callback(error); },
      });
      upstream.on('error', () => stream.destroy(new Error('Model transfer interrupted')));
      upstream.pipe(stream);
      return { stream, sizeBytes: expectedBytes };
    } catch {
      throw new BadGatewayException('Không tải được mô hình từ kho lưu trữ. Hãy thử lại.');
    }
  }
}
