import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
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
