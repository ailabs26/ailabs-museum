import { registerAs } from '@nestjs/config';
import { DEV_MEDIA_URL_SIGNING_SECRET } from './env.validation';

/**
 * Cấu hình phân phối media — namespace 'media'.
 * - `publicBaseUrl`: origin của API dùng để dựng URL tuyệt đối (FE chạy khác origin).
 * - `urlSigningSecret`: khóa HMAC ký URL xem trước media chưa công khai (Preview CMS).
 * - `signedUrlTtlSeconds`: thời hạn URL đã ký.
 * - `storageDriver`: nơi lưu file — `local` (đĩa, dev) hoặc `supabase` (Supabase Storage).
 * - `supabase`: Project URL, khóa service_role (chỉ ở server) và bucket private.
 */
export const mediaConfig = registerAs('media', () => ({
  publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL ?? 'http://localhost:3001',
  urlSigningSecret: process.env.MEDIA_URL_SIGNING_SECRET ?? DEV_MEDIA_URL_SIGNING_SECRET,
  signedUrlTtlSeconds: parseInt(process.env.MEDIA_SIGNED_URL_TTL_SECONDS ?? '900', 10),
  storageDriver: process.env.MEDIA_STORAGE_DRIVER ?? 'local',
  /** Chế độ job dọn media mồ côi: off | dry-run | on. */
  orphanCleanup: (process.env.MEDIA_ORPHAN_CLEANUP ?? 'dry-run') as 'off' | 'dry-run' | 'on',
  trashRetentionDays: parseInt(process.env.MEDIA_TRASH_RETENTION_DAYS ?? '30', 10),
  /** Số job upload bất đồng bộ chạy cùng lúc trong một tiến trình; job còn lại chờ FIFO. */
  uploadJobRetentionDays: undefined as unknown as number,
  uploadJobConcurrency: parseInt(process.env.MEDIA_UPLOAD_JOB_CONCURRENCY ?? '3', 10),
  supabase: {
    url: (process.env.SUPABASE_URL ?? '').replace(/\/+$/, ''),
    // Khóa mới `sb_secret_...` ưu tiên; khóa legacy service_role vẫn dùng được.
    serviceKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'museum-assets',
  },
}));
