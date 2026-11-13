/** Đọc biến môi trường Vite, có mặc định an toàn cho dev. */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api',
  mediaBaseUrl: import.meta.env.VITE_MEDIA_BASE_URL ?? 'http://localhost:3001/media',
  /** Địa chỉ trang khách in trên mã QR; trống thì dùng địa chỉ đang mở (cùng origin với CMS). */
  publicSiteUrl: import.meta.env.VITE_PUBLIC_SITE_URL ?? '',
} as const;
