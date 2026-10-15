import { registerAs } from '@nestjs/config';

/**
 * Cấu hình phân phối media — namespace 'media'.
 * - `publicBaseUrl`: origin của API dùng để dựng URL tuyệt đối (FE chạy khác origin).
 * - `urlSigningSecret`: khóa HMAC ký URL xem trước media chưa công khai (Preview CMS).
 * - `signedUrlTtlSeconds`: thời hạn URL đã ký.
 */
export const mediaConfig = registerAs('media', () => ({
  publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL ?? 'http://localhost:3001',
  urlSigningSecret:
    process.env.MEDIA_URL_SIGNING_SECRET ?? 'dev-media-url-signing-secret-change-me-please',
  signedUrlTtlSeconds: parseInt(process.env.MEDIA_SIGNED_URL_TTL_SECONDS ?? '900', 10),
}));
