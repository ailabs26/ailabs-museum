import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { parseTrustProxy } from './app.config';

/** Khóa mặc định chỉ để chạy dev/test; production phải tự đặt khóa riêng. */
export const DEV_JWT_ACCESS_SECRET = 'dev-access-secret-change-me-please';
export const DEV_MEDIA_URL_SIGNING_SECRET = 'dev-media-url-signing-secret-change-me-please';

/** Khóa mẫu công khai (mã nguồn + .env.example) — không bao giờ được dùng ở production. */
const PLACEHOLDER_SECRETS = new Set([
  DEV_JWT_ACCESS_SECRET,
  DEV_MEDIA_URL_SIGNING_SECRET,
  'đổi-khóa-bí-mật-tối-thiểu-16-ký-tự',
  'đổi-khóa-ký-url-media-tối-thiểu-32-ký-tự',
]);
const PRODUCTION_SECRETS = ['JWT_ACCESS_SECRET', 'MEDIA_URL_SIGNING_SECRET'] as const;
const PRODUCTION_SECRET_MIN_LENGTH = 32;

class Environment {
  /** Môi trường chạy; `production` bật các kiểm tra khóa bí mật chặt hơn. */
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsUrl({ require_tld: false })
  FRONTEND_ORIGIN: string = 'http://localhost:5173';

  @IsString()
  DATABASE_URL: string = '';

  /** Bật TLS khi kết nối DB (bắt buộc với Supabase). Chuỗi 'true'/'false'. */
  @IsIn(['true', 'false'])
  DATABASE_SSL: string = 'false';

  /**
   * Số proxy đứng trước API để Express lấy đúng IP client từ X-Forwarded-For (issue #82):
   * `false` (mặc định, không proxy) | số hop (vd `1`) | `true` | danh sách IP/subnet/`loopback`.
   * Kiểm tra cú pháp ở `validateEnvironment` (dùng chung `parseTrustProxy`).
   */
  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  /** Đường dẫn file CA để xác thực chứng chỉ DB; bỏ trống thì không xác thực chứng chỉ. */
  @IsOptional()
  @IsString()
  DATABASE_SSL_CA?: string;

  // --- Xác thực (xem docs/plans/admin-subsystem-plan.md §2) ---

  /** Khóa ký access token JWT. Bắt buộc đặt ở môi trường thật. */
  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET: string = DEV_JWT_ACCESS_SECRET;

  /** Hạn access token, theo cú pháp thời lượng của jsonwebtoken (vd 15m, 1h). */
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  /** Hạn refresh token tính theo ngày. */
  @IsInt()
  @Min(1)
  @Max(90)
  JWT_REFRESH_TTL_DAYS: number = 7;

  /** Tên httpOnly cookie chứa refresh token. */
  @IsString()
  REFRESH_COOKIE_NAME: string = 'aura_rt';

  /**
   * Giới hạn POST /auth/refresh mỗi phút (issue #126), tách khỏi login: theo phiên (family refresh token),
   * trần rộng theo IP (văn phòng chung IP vẫn dùng được), và theo IP cho request không có/cookie sai.
   */
  @IsInt()
  @Min(1)
  @Max(10000)
  REFRESH_RATE_LIMIT_PER_SESSION: number = 30;

  @IsInt()
  @Min(1)
  @Max(10000)
  REFRESH_RATE_LIMIT_PER_IP: number = 300;

  @IsInt()
  @Min(1)
  @Max(10000)
  REFRESH_RATE_LIMIT_INVALID_PER_IP: number = 20;

  /** Số báo cáo nội dung công khai được gửi từ một IP mỗi phút. */
  @IsInt()
  @Min(1)
  @Max(100)
  PUBLIC_REPORT_RATE_LIMIT: number = 5;

  /** Cost factor hash bcrypt. */
  @IsInt()
  @Min(10)
  @Max(15)
  BCRYPT_ROUNDS: number = 12;

  // --- Phân phối media (Task 9) ---

  /** Origin công khai của API, dùng dựng URL media tuyệt đối (không có dấu / cuối). */
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  MEDIA_PUBLIC_BASE_URL: string = 'http://localhost:3001';

  /** Khóa HMAC ký URL xem trước media chưa công khai. Bắt buộc đặt ở môi trường thật. */
  @IsString()
  @MinLength(32)
  MEDIA_URL_SIGNING_SECRET: string = DEV_MEDIA_URL_SIGNING_SECRET;

  /** Thời hạn URL media đã ký (giây). */
  @IsInt()
  @Min(60)
  @Max(86400)
  MEDIA_SIGNED_URL_TTL_SECONDS: number = 900;

  /** Nơi lưu file media: `local` (đĩa, dev) | `supabase` (Supabase Storage). */
  @IsIn(['local', 'supabase'])
  MEDIA_STORAGE_DRIVER: string = 'local';

  /** Project URL của Supabase, vd https://<ref>.supabase.co — bắt buộc khi driver = supabase. */
  @ValidateIf((env: Environment) => env.MEDIA_STORAGE_DRIVER === 'supabase')
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  SUPABASE_URL?: string;

  /** Khóa secret (`sb_secret_...`) của Supabase — CHỈ để ở back-end. Bắt buộc 1 trong 2 khóa khi driver = supabase. */
  @ValidateIf((env: Environment) => env.MEDIA_STORAGE_DRIVER === 'supabase' && !env.SUPABASE_SERVICE_ROLE_KEY)
  @IsString()
  @MinLength(20)
  SUPABASE_SECRET_KEY?: string;

  /** Khóa legacy `service_role`, dùng khi chưa có SUPABASE_SECRET_KEY. */
  @ValidateIf((env: Environment) => env.MEDIA_STORAGE_DRIVER === 'supabase' && !env.SUPABASE_SECRET_KEY)
  @IsString()
  @MinLength(20)
  SUPABASE_SERVICE_ROLE_KEY?: string;

  /** Bucket PRIVATE chứa media (dùng chung với GLB của tour). */
  @IsString()
  SUPABASE_STORAGE_BUCKET: string = 'museum-assets';

  // --- Seed (chỉ dùng khi chạy script seed) ---

  @IsOptional()
  @IsString()
  SEED_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_PASSWORD?: string;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const env = plainToInstance(Environment, input, {
    enableImplicitConversion: true,
  });
  const invalidFields = validateSync(env, { skipMissingProperties: false }).map((item) => item.property);

  if (!env.DATABASE_URL && !invalidFields.includes('DATABASE_URL')) invalidFields.push('DATABASE_URL');
  try {
    parseTrustProxy(env.TRUST_PROXY);
  } catch {
    invalidFields.push('TRUST_PROXY');
  }
  if (env.NODE_ENV === 'production') {
    invalidFields.push(...weakProductionSecrets(input).filter((key) => !invalidFields.includes(key)));
  }

  // Chỉ nêu tên biến, không bao giờ in giá trị (có thể là khóa bí mật).
  if (invalidFields.length) {
    throw new Error(`Invalid environment: ${invalidFields.join(', ')}`);
  }

  return env;
}

/**
 * Production phải đặt tường minh từng khóa bí mật: không rơi về khóa mặc định của dev, không dùng
 * khóa mẫu công khai, đủ dài. Nếu không, ai đọc mã nguồn cũng ký được token admin / URL media.
 */
function weakProductionSecrets(input: Record<string, unknown>): string[] {
  return PRODUCTION_SECRETS.filter((key) => {
    const value = input[key];
    return (
      typeof value !== 'string' ||
      value.length < PRODUCTION_SECRET_MIN_LENGTH ||
      PLACEHOLDER_SECRETS.has(value)
    );
  });
}
