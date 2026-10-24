import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { appConfig } from '../app.config';
import { databaseConfig } from '../database.config';
import { validateEnvironment } from '../env.validation';
import { jwtConfig } from '../jwt.config';

const BASE = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };
const ENV_KEYS = ['PORT', 'FRONTEND_ORIGIN', 'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL',
  'JWT_REFRESH_TTL_DAYS', 'REFRESH_COOKIE_NAME', 'BCRYPT_ROUNDS', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'];
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function invalidFields(input: Record<string, unknown>): string {
  try {
    validateEnvironment(input);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('validateEnvironment', () => {
  it('chấp nhận cấu hình tối thiểu và áp giá trị mặc định an toàn', () => {
    const env = validateEnvironment({ ...BASE });
    assert.equal(env.PORT, 3001);
    assert.equal(env.DATABASE_SSL, 'false');
    assert.equal(env.BCRYPT_ROUNDS, 12);
    assert.equal(env.JWT_REFRESH_TTL_DAYS, 7);
    assert.equal(env.MEDIA_STORAGE_DRIVER, 'local');
  });

  it('ép kiểu chuỗi số từ biến môi trường', () => {
    const env = validateEnvironment({ ...BASE, PORT: '8080', BCRYPT_ROUNDS: '13' });
    assert.equal(env.PORT, 8080);
    assert.equal(env.BCRYPT_ROUNDS, 13);
  });

  it('thiếu DATABASE_URL → lỗi', () => {
    assert.match(invalidFields({}), /DATABASE_URL/);
  });

  for (const [field, value] of [
    ['JWT_ACCESS_SECRET', 'short'],
    ['BCRYPT_ROUNDS', '9'],
    ['BCRYPT_ROUNDS', '16'],
    ['JWT_REFRESH_TTL_DAYS', '0'],
    ['JWT_REFRESH_TTL_DAYS', '91'],
    ['DATABASE_SSL', 'yes'],
    ['PORT', '70000'],
    ['FRONTEND_ORIGIN', 'not a url'],
    ['MEDIA_URL_SIGNING_SECRET', 'too-short'],
    ['MEDIA_STORAGE_DRIVER', 's3'],
  ] as const) {
    it(`từ chối ${field}=${value}`, () => {
      assert.match(invalidFields({ ...BASE, [field]: value }), new RegExp(field));
    });
  }

  it('driver supabase bắt buộc URL + khóa secret', () => {
    const message = invalidFields({ ...BASE, MEDIA_STORAGE_DRIVER: 'supabase' });
    assert.match(message, /SUPABASE_URL/);
    assert.match(message, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
    validateEnvironment({
      ...BASE,
      MEDIA_STORAGE_DRIVER: 'supabase',
      SUPABASE_URL: 'https://ref.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
    });
  });
});

describe('registerAs config', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('đọc giá trị từ process.env', () => {
    Object.assign(process.env, {
      PORT: '4000', FRONTEND_ORIGIN: 'https://museum.example', DATABASE_URL: 'postgres://x',
      JWT_ACCESS_SECRET: 's'.repeat(20), JWT_ACCESS_TTL: '5m', JWT_REFRESH_TTL_DAYS: '3',
      REFRESH_COOKIE_NAME: 'rt', BCRYPT_ROUNDS: '11', SEED_ADMIN_EMAIL: 'a@b.c',
    });
    assert.deepEqual(appConfig(), {
      port: 4000, frontendOrigin: 'https://museum.example', apiPrefix: 'api',
      seedAdminEmail: 'a@b.c', seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
    });
    assert.deepEqual(databaseConfig(), { url: 'postgres://x' });
    assert.deepEqual(jwtConfig(), {
      accessSecret: 's'.repeat(20), accessTtl: '5m', refreshTtlDays: 3, refreshCookieName: 'rt', bcryptRounds: 11,
    });
  });

  it('rơi về mặc định khi biến môi trường vắng', () => {
    for (const key of ENV_KEYS) delete process.env[key];
    assert.equal(appConfig().port, 3001);
    assert.equal(appConfig().frontendOrigin, 'http://localhost:5173');
    assert.equal(jwtConfig().accessTtl, '15m');
    assert.equal(jwtConfig().bcryptRounds, 12);
    assert.equal(jwtConfig().refreshCookieName, 'aura_rt');
  });
});
