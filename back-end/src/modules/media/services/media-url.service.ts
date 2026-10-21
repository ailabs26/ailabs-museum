import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PUBLIC_MEDIA_URL_PREFIX } from './media-storage.service';

export const MEDIA_URL_OPTIONS = Symbol('MEDIA_URL_OPTIONS');

export interface MediaUrlOptions {
  /** Origin công khai của API, ví dụ `https://api.example.com`. */
  publicBaseUrl: string;
  /** Khóa HMAC-SHA256 ký URL xem trước. */
  signingSecret: string;
  /** Thời hạn URL đã ký (giây). */
  signedUrlTtlSeconds: number;
}

/** Chỉ file trong vùng public mới có URL; vùng cách ly không bao giờ được phân phối. */
const DELIVERABLE_KEY_PREFIX = 'uploads/';
const EXPIRES_PATTERN = /^\d{1,12}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Dựng URL media tuyệt đối và ký/kiểm URL xem trước.
 *
 * - URL công khai (không chữ ký): chỉ tải được khi media đang được revision public hiện
 *   hành tham chiếu (kiểm ở `MediaDeliveryService`).
 * - URL đã ký: cho Preview CMS xem media của Draft; chữ ký gắn với đúng storage key và
 *   thời điểm hết hạn, không dùng lại được cho file khác.
 */
@Injectable()
export class MediaUrlService {
  private readonly baseUrl: string;

  constructor(@Inject(MEDIA_URL_OPTIONS) private readonly options: MediaUrlOptions) {
    this.baseUrl = options.publicBaseUrl.replace(/\/+$/, '');
  }

  /** URL tuyệt đối không chữ ký; `null` với key không thuộc vùng public. */
  publicUrl(storageKey: string): string | null {
    if (!storageKey.startsWith(DELIVERABLE_KEY_PREFIX)) return null;
    return `${this.baseUrl}${PUBLIC_MEDIA_URL_PREFIX}/${storageKey}`;
  }

  /** URL tuyệt đối có chữ ký, hết hạn sau `signedUrlTtlSeconds`. */
  signedUrl(storageKey: string, nowMs: number = Date.now()): string | null {
    const url = this.publicUrl(storageKey);
    if (!url) return null;
    const expires = Math.floor(nowMs / 1000) + this.options.signedUrlTtlSeconds;
    return `${url}?exp=${expires}&sig=${this.sign(storageKey, expires)}`;
  }

  /**
   * Kiểm tra chữ ký của URL xem trước. Mọi tham số sai kiểu/định dạng, hết hạn hoặc
   * thời hạn dài hơn TTL cho phép đều trả `false` (không ném lỗi).
   */
  verify(storageKey: string, expires: unknown, signature: unknown, nowMs: number = Date.now()): boolean {
    if (typeof expires !== 'string' || typeof signature !== 'string') return false;
    if (!EXPIRES_PATTERN.test(expires) || !SIGNATURE_PATTERN.test(signature)) return false;

    const expiresAt = Number(expires);
    const now = Math.floor(nowMs / 1000);
    if (expiresAt <= now || expiresAt - now > this.options.signedUrlTtlSeconds) return false;

    const expected = Buffer.from(this.sign(storageKey, expiresAt), 'hex');
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  }

  private sign(storageKey: string, expires: number): string {
    return createHmac('sha256', this.options.signingSecret)
      .update(`${storageKey}\n${expires}`)
      .digest('hex');
  }
}
