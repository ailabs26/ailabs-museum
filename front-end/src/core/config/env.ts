/** Đọc biến môi trường Vite, có mặc định an toàn cho dev. */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api',
  mediaBaseUrl: import.meta.env.VITE_MEDIA_BASE_URL ?? 'http://localhost:3001/media',
} as const;
