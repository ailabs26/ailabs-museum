import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { appConfig, parseTrustProxy } from '../app.config';
import { databaseConfig } from '../database.config';
import { DEV_JWT_ACCESS_SECRET, DEV_MEDIA_URL_SIGNING_SECRET, validateEnvironment } from '../env.validation';
import { jwtConfig } from '../jwt.config';
import { reportsConfig } from '../reports.config';

const BASE = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };
const ENV_KEYS = ['PORT', 'FRONTEND_ORIGIN', 'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL',
  'JWT_REFRESH_TTL_DAYS', 'REFRESH_COOKIE_NAME', 'BCRYPT_ROUNDS', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD', 'TRUST_PROXY',
  'REFRESH_RATE_LIMIT_PER_SESSION', 'REFRESH_RATE_LIMIT_PER_IP', 'REFRESH_RATE_LIMIT_INVALID_PER_IP', 'PUBLIC_REPORT_RATE_LIMIT'];
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
    assert.equal(env.REFRESH_RATE_LIMIT_PER_SESSION, 30);
    assert.equal(env.REFRESH_RATE_LIMIT_PER_IP, 300);
    assert.equal(env.REFRESH_RATE_LIMIT_INVALID_PER_IP, 20);
    assert.equal(env.PUBLIC_REPORT_RATE_LIMIT, 5);
  });

  it('accepts report limits at both inclusive boundaries', () => {
    assert.equal(validateEnvironment({ ...BASE, PUBLIC_REPORT_RATE_LIMIT: '1' }).PUBLIC_REPORT_RATE_LIMIT, 1);
    assert.equal(validateEnvironment({ ...BASE, PUBLIC_REPORT_RATE_LIMIT: '100' }).PUBLIC_REPORT_RATE_LIMIT, 100);
  });

  for (const value of ['0', '101', '1.5']) {
    it(`rejects PUBLIC_REPORT_RATE_LIMIT=${value}`, () => {
      assert.match(invalidFields({ ...BASE, PUBLIC_REPORT_RATE_LIMIT: value }), /PUBLIC_REPORT_RATE_LIMIT/);
    });
  }

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
    ['NODE_ENV', 'staging'],
    ['TRUST_PROXY', 'yes'],
    ['REFRESH_RATE_LIMIT_PER_SESSION', '0'],
    ['REFRESH_RATE_LIMIT_PER_IP', '10001'],
    ['REFRESH_RATE_LIMIT_INVALID_PER_IP', 'abc'],
    ['TRUST_PROXY', '10.0.0.0/8, proxy.local'],
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

describe('validateEnvironment — production', () => {
  const STRONG_JWT = 'j'.repeat(32);
  const STRONG_MEDIA = 'm'.repeat(40);
  const PROD = { ...BASE, NODE_ENV: 'production' };

  it('đủ khóa riêng, đủ dài → chạy được', () => {
    const env = validateEnvironment({ ...PROD, JWT_ACCESS_SECRET: STRONG_JWT, MEDIA_URL_SIGNING_SECRET: STRONG_MEDIA });
    assert.equal(env.NODE_ENV, 'production');
  });

  it('không đặt khóa (rơi về khóa dev mặc định) → từ chối cả hai', () => {
    const message = invalidFields({ ...PROD });
    assert.match(message, /JWT_ACCESS_SECRET/);
    assert.match(message, /MEDIA_URL_SIGNING_SECRET/);
  });

  for (const [name, input] of [
    ['khóa dev mặc định', { JWT_ACCESS_SECRET: DEV_JWT_ACCESS_SECRET, MEDIA_URL_SIGNING_SECRET: DEV_MEDIA_URL_SIGNING_SECRET }],
    ['khóa mẫu của .env.example', {
      JWT_ACCESS_SECRET: 'đổi-khóa-bí-mật-tối-thiểu-16-ký-tự',
      MEDIA_URL_SIGNING_SECRET: 'đổi-khóa-ký-url-media-tối-thiểu-32-ký-tự',
    }],
    ['khóa ngắn hơn 32 ký tự', { JWT_ACCESS_SECRET: 'x'.repeat(31), MEDIA_URL_SIGNING_SECRET: 'y'.repeat(31) }],
  ] as const) {
    it(`từ chối ${name}, thông báo chỉ nêu tên biến`, () => {
      const fields = invalidFields({ ...PROD, ...input }).replace('Invalid environment: ', '').split(', ');
      assert.deepEqual(fields.sort(), ['JWT_ACCESS_SECRET', 'MEDIA_URL_SIGNING_SECRET']);
    });
  }

  it('chỉ báo đúng khóa yếu, không lặp tên biến đã lỗi', () => {
    assert.equal(
      invalidFields({ ...PROD, JWT_ACCESS_SECRET: 'short', MEDIA_URL_SIGNING_SECRET: STRONG_MEDIA }),
      'Invalid environment: JWT_ACCESS_SECRET',
    );
  });

  it('development/test vẫn dùng được khóa mặc định', () => {
    validateEnvironment({ ...BASE });
    validateEnvironment({ ...BASE, NODE_ENV: 'test' });
    validateEnvironment({ ...BASE, NODE_ENV: 'development', JWT_ACCESS_SECRET: DEV_JWT_ACCESS_SECRET });
  });
});

describe('parseTrustProxy', () => {
  for (const [raw, expected] of [
    [undefined, false],
    ['', false],
    ['false', false],
    ['true', true],
    ['1', 1],
    [' 2 ', 2],
    ['loopback', ['loopback']],
    ['loopback, 10.0.0.0/8 ,fd00::/8', ['loopback', '10.0.0.0/8', 'fd00::/8']],
    ['203.0.113.7', ['203.0.113.7']],
  ] as const) {
    it(`${JSON.stringify(raw)} → ${JSON.stringify(expected)}`, () => {
      assert.deepEqual(parseTrustProxy(raw), expected);
    });
  }

  for (const raw of ['yes', '-1', '1.5', 'proxy.local', '10.0.0.0/8,,']) {
    it(`từ chối ${JSON.stringify(raw)}`, () => {
      assert.throws(() => parseTrustProxy(raw), /TRUST_PROXY/);
    });
  }
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
      REFRESH_COOKIE_NAME: 'rt', BCRYPT_ROUNDS: '11', SEED_ADMIN_EMAIL: 'a@b.c', TRUST_PROXY: '1',
      REFRESH_RATE_LIMIT_PER_SESSION: '12', REFRESH_RATE_LIMIT_PER_IP: '500', REFRESH_RATE_LIMIT_INVALID_PER_IP: '7',
    });
    assert.deepEqual(appConfig(), {
      port: 4000, frontendOrigin: 'https://museum.example', apiPrefix: 'api', trustProxy: 1,
      seedAdminEmail: 'a@b.c', seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
    });
    assert.deepEqual(databaseConfig(), { url: 'postgres://x' });
    assert.deepEqual(jwtConfig(), {
      accessSecret: 's'.repeat(20), accessTtl: '5m', refreshTtlDays: 3, refreshCookieName: 'rt', bcryptRounds: 11,
      refreshRateLimit: { perSession: 12, perIp: 500, invalidPerIp: 7 },
    });
    assert.deepEqual(reportsConfig(), { publicRateLimit: 5 });
  });

  it('rơi về mặc định khi biến môi trường vắng', () => {
    for (const key of ENV_KEYS) delete process.env[key];
    assert.equal(appConfig().port, 3001);
    assert.equal(appConfig().frontendOrigin, 'http://localhost:5173');
    assert.equal(appConfig().trustProxy, false);
    assert.equal(jwtConfig().accessTtl, '15m');
    assert.equal(jwtConfig().bcryptRounds, 12);
    assert.equal(jwtConfig().refreshCookieName, 'aura_rt');
    assert.deepEqual(jwtConfig().refreshRateLimit, { perSession: 30, perIp: 300, invalidPerIp: 20 });
    assert.equal(reportsConfig().publicRateLimit, 5);
  });

  it('đọc giới hạn báo cáo từ biến môi trường dưới dạng số', () => {
    process.env.PUBLIC_REPORT_RATE_LIMIT = '23';
    assert.deepEqual(reportsConfig(), { publicRateLimit: 23 });
  });
});
