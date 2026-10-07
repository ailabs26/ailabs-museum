import { plainToInstance } from 'class-transformer';
import { IsInt, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

class Environment {
  @IsInt() @Min(1) @Max(65535) PORT: number = 3001;
  @IsUrl({ require_tld: false }) FRONTEND_ORIGIN: string = 'http://localhost:5173';
  @IsString() DATABASE_URL: string = '';
}

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const env = plainToInstance(Environment, input, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length || !env.DATABASE_URL) {
    throw new Error(`Invalid environment: ${errors.map((item) => item.property).join(', ') || 'DATABASE_URL'}`);
  }
  return env;
}
