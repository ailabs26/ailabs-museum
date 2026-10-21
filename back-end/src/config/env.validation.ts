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

class Environment {
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

  /** Đường dẫn file CA để xác thực chứng chỉ DB; bỏ trống thì không xác thực chứng chỉ. */
  @IsOptional()
  @IsString()
  DATABASE_SSL_CA?: string;

  // --- Xác thực (xem docs/plans/admin-subsystem-plan.md §2) ---

  /** Khóa ký access token JWT. Bắt buộc đặt ở môi trường thật. */
  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET: string = 'dev-access-secret-change-me-please';

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
  MEDIA_URL_SIGNING_SECRET: string = 'dev-media-url-signing-secret-change-me-please';

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
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length || !env.DATABASE_URL) {
    const invalidFields = errors.map((item) => item.property).join(', ');
    throw new Error(`Invalid environment: ${invalidFields || 'DATABASE_URL'}`);
  }

  return env;
}
