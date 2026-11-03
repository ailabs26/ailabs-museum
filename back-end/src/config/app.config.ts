import { registerAs } from '@nestjs/config';

/** Giá trị `trust proxy` của Express: tắt, tin mọi proxy, số hop, hoặc danh sách IP/subnet. */
export type TrustProxy = boolean | number | string[];

const NAMED_PROXY_RANGES = new Set(['loopback', 'linklocal', 'uniquelocal']);
/** IPv4 hoặc IPv6, có thể kèm độ dài subnet (vd 10.0.0.0/8, fd00::/8). */
const PROXY_ADDRESS = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]*:[0-9a-fA-F:.]*)(\/\d{1,3})?$/;

/**
 * Đọc `TRUST_PROXY` (issue #82). Sau reverse proxy, `req.ip` chỉ là IP của proxy nếu không bật —
 * rate limit đăng nhập chặn chung mọi người, phiên/audit ghi sai IP. Không bật `true` khi API nhận
 * request trực tiếp: client tự giả được X-Forwarded-For. Giá trị sai cú pháp → ném lỗi.
 */
export function parseTrustProxy(raw: string | undefined): TrustProxy {
  const value = raw?.trim() ?? '';
  if (value === '' || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);

  const entries = value.split(',').map((item) => item.trim());
  const invalid = entries.some((item) => !NAMED_PROXY_RANGES.has(item) && !PROXY_ADDRESS.test(item));
  if (invalid) throw new Error('TRUST_PROXY không hợp lệ');
  return entries;
}

/** Cấu hình ứng dụng (port, CORS origin, prefix API, trust proxy) — namespace 'app'. */
export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  apiPrefix: 'api',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL,
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
}));
