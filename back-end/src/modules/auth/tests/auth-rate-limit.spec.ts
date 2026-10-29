import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { HttpException, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { appConfig, jwtConfig } from '../../../config';
import { AuthController } from '../controllers/auth.controller';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { AuthRateLimiter, DEFAULT_AUTH_RATE_LIMITS } from '../services/auth-rate-limiter.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuthService } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';
import { TokenService } from '../services/token.service';

const status = (fn: () => void): number | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as HttpException).getStatus();
  }
};

describe('AuthRateLimiter', () => {
  const make = () => {
    const limiter = new AuthRateLimiter();
    let t = 1_000_000;
    limiter.now = () => t;
    return { limiter, advance: (ms: number) => (t += ms) };
  };

  it('email: 5 lần sai trong 15 phút thì lần kế bị 429, hết cửa sổ thì mở lại', () => {
    const { limiter, advance } = make();
    for (let i = 0; i < 5; i++) {
      assert.equal(status(() => limiter.assertEmailAllowed('A@b.c')), null);
      limiter.recordEmailFailure('a@b.c'); // không phân biệt hoa/thường
    }
    assert.equal(status(() => limiter.assertEmailAllowed('a@b.c')), 429);
    assert.equal(status(() => limiter.assertEmailAllowed('khac@b.c')), null);
    advance(15 * 60_000 + 1);
    assert.equal(status(() => limiter.assertEmailAllowed('a@b.c')), null);
  });

  it('email: đăng nhập đúng xóa bộ đếm', () => {
    const { limiter } = make();
    for (let i = 0; i < 4; i++) limiter.recordEmailFailure('a@b.c');
    limiter.resetEmail('a@b.c');
    limiter.recordEmailFailure('a@b.c');
    assert.equal(status(() => limiter.assertEmailAllowed('a@b.c')), null);
  });

  it('IP: 20 request/phút, request thứ 21 bị 429 kèm retryAfter, IP khác không ảnh hưởng', () => {
    const { limiter, advance } = make();
    for (let i = 0; i < 20; i++) limiter.consumeIp('1.1.1.1');
    let retryAfter = 0;
    try {
      limiter.consumeIp('1.1.1.1');
    } catch (e) {
      retryAfter = ((e as HttpException).getResponse() as { retryAfter: number }).retryAfter;
    }
    assert.ok(retryAfter >= 1 && retryAfter <= 60);
    assert.equal(status(() => limiter.consumeIp('2.2.2.2')), null);
    advance(60_001);
    assert.equal(status(() => limiter.consumeIp('1.1.1.1')), null);
  });
});

describe('AuthRateLimiter — refresh tách khỏi login (issue #126)', () => {
  const make = (config?: ConfigService) => {
    const limiter = new AuthRateLimiter(config);
    let t = 1_000_000;
    limiter.now = () => t;
    return { limiter, advance: (ms: number) => (t += ms) };
  };
  const exhaust = (fn: () => void, times: number) => { for (let i = 0; i < times; i++) fn(); };

  it('login dùng hết 20/phút/IP không ảnh hưởng refresh của cùng IP, và ngược lại', () => {
    const { limiter } = make();
    exhaust(() => limiter.consumeIp('1.1.1.1'), 20);
    assert.equal(status(() => limiter.consumeIp('1.1.1.1')), 429);
    assert.equal(status(() => limiter.consumeRefreshIp('1.1.1.1')), null);
    assert.equal(status(() => limiter.consumeRefreshInvalid('1.1.1.1')), null);

    const other = make().limiter;
    exhaust(() => other.consumeRefreshInvalid('2.2.2.2'), 20);
    assert.equal(status(() => other.consumeRefreshInvalid('2.2.2.2')), 429);
    assert.equal(status(() => other.consumeIp('2.2.2.2')), null);
  });

  it('mỗi phiên 30 lần/phút: phiên vượt ngưỡng bị 429, phiên khác cùng IP không ảnh hưởng, hết cửa sổ thì mở lại', () => {
    const { limiter, advance } = make();
    exhaust(() => limiter.consumeRefreshSession('family-a'), 30);
    assert.equal(status(() => limiter.consumeRefreshSession('family-a')), 429);
    assert.equal(status(() => limiter.consumeRefreshSession('family-b')), null);
    advance(60_001);
    assert.equal(status(() => limiter.consumeRefreshSession('family-a')), null);
  });

  it('trần theo IP 300/phút; request không có/sai cookie 20/phút/IP', () => {
    const { limiter } = make();
    exhaust(() => limiter.consumeRefreshIp('3.3.3.3'), 300);
    assert.equal(status(() => limiter.consumeRefreshIp('3.3.3.3')), 429);
    exhaust(() => limiter.consumeRefreshInvalid('3.3.3.3'), 20);
    assert.equal(status(() => limiter.consumeRefreshInvalid('3.3.3.3')), 429);
  });

  it('ngưỡng refresh đọc từ cấu hình jwt.refreshRateLimit; thiếu cấu hình thì dùng mặc định', () => {
    const config = { get: (key: string) => (key === 'jwt.refreshRateLimit' ? { perSession: 2, perIp: 3, invalidPerIp: 1 } : undefined) };
    const { limiter } = make(config as unknown as ConfigService);
    assert.deepEqual(
      [limiter.limits.refreshPerSession, limiter.limits.refreshPerIp, limiter.limits.refreshInvalidPerIp, limiter.limits.ipRequests],
      [2, 3, 1, 20],
    );
    exhaust(() => limiter.consumeRefreshSession('f'), 2);
    assert.equal(status(() => limiter.consumeRefreshSession('f')), 429);
    assert.deepEqual(new AuthRateLimiter().limits, DEFAULT_AUTH_RATE_LIMITS);
  });

  it('audit "bị chặn" của refresh: 1 lần mỗi cửa sổ 1 phút cho mỗi khóa', () => {
    const { limiter, advance } = make();
    assert.equal(limiter.shouldAuditBlock('refresh_session', 'f1'), true);
    assert.equal(limiter.shouldAuditBlock('refresh_session', 'f1'), false);
    assert.equal(limiter.shouldAuditBlock('refresh_session', 'f2'), true);
    assert.equal(limiter.shouldAuditBlock('refresh_invalid', 'f1'), true);
    advance(60_001);
    assert.equal(limiter.shouldAuditBlock('refresh_session', 'f1'), true);
  });
});

describe('AuthController HTTP — rate limit', () => {
  let app: INestApplication;
  let loginCalls = 0;
  const audits: Array<{ action: string; resourceId: string | null; reason: string | null }> = [];

  before(async () => {
    const auth = {
      login: async (dto: { password: string }) => {
        loginCalls++;
        if (dto.password !== 'Passw0rd!') throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
        return { accessToken: 'acc', refreshToken: 'rt', user: { id: 'u1' } };
      },
      refresh: async () => ({ accessToken: 'a', refreshToken: 'r' }),
      logout: async () => undefined,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] })],
      controllers: [AuthController],
      providers: [
        RefreshCookieOriginGuard,
        AuthRateLimiter,
        { provide: AuditService, useValue: { recordSafely: async (event: (typeof audits)[number]) => { audits.push(event); } } },
        { provide: SessionsService, useValue: {} },
        { provide: AuthService, useValue: auth },
        {
          provide: TokenService,
          useValue: {
            refreshCookieMaxAgeMs: () => 1000,
            // Cookie "fam-…" thuộc phiên cùng tên; còn lại không khớp phiên nào.
            findSessionOwner: async (raw: string) => (raw.startsWith('fam-') ? { familyId: raw, userId: `user-of-${raw}` } : null),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  after(async () => {
    await app?.close();
  });

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  it('sai mật khẩu 5 lần → lần 6 là 429 + Retry-After, service không bị gọi; đúng mật khẩu cũng bị chặn', async () => {
    for (let i = 0; i < 5; i++) await login('victim@aura.local', 'wrong-password').expect(401);
    loginCalls = 0;
    const res = await login('victim@aura.local', 'Passw0rd!').expect(429);
    assert.ok(Number(res.headers['retry-after']) >= 1);
    assert.equal(loginCalls, 0);
  });

  it('email khác vẫn đăng nhập được; đăng nhập đúng xóa bộ đếm sai trước đó', async () => {
    for (let i = 0; i < 3; i++) await login('other@aura.local', 'wrong-password').expect(401);
    await login('other@aura.local', 'Passw0rd!').expect(200);
    for (let i = 0; i < 4; i++) await login('other@aura.local', 'wrong-password').expect(401);
  });

  const refresh = (cookie?: string) => {
    const req = request(app.getHttpServer()).post('/auth/refresh');
    return cookie ? req.set('Cookie', `aura_rt=${cookie}`) : req;
  };

  it('25 người chung IP văn phòng (mỗi người 1 phiên) làm mới liên tục: không ai bị 429, login của IP vẫn được', async () => {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 25; i++) await refresh(`fam-office-${i}`).expect(200);
    }
    await login('fourth@aura.local', 'Passw0rd!').expect(200);
  });

  it('một phiên refresh dồn dập: lần 31 trong phút → 429 + Retry-After, audit 1 lần; phiên khác cùng IP vẫn được', async () => {
    audits.length = 0;
    for (let i = 0; i < 30; i++) await refresh('fam-busy').expect(200);
    const res = await refresh('fam-busy').expect(429);
    assert.ok(Number(res.headers['retry-after']) >= 1);
    await refresh('fam-busy').expect(429);
    await refresh('fam-calm').expect(200);
    assert.deepEqual(audits.map(({ action, resourceId, reason }) => ({ action, resourceId, reason })), [
      { action: 'auth.refresh_blocked', resourceId: 'user-of-fam-busy', reason: '{"limit":"session"}' },
    ]);
  });

  it('không có / sai cookie: 20 lần/phút/IP rồi 429 (chống dò token), không ảnh hưởng phiên hợp lệ cùng IP', async () => {
    audits.length = 0;
    for (let i = 0; i < 10; i++) await refresh().expect(200);
    for (let i = 0; i < 10; i++) await refresh(`guess-${i}`).expect(200);
    await refresh('guess-x').expect(429);
    await refresh().expect(429);
    await refresh('fam-calm').expect(200);
    assert.deepEqual(audits.map(({ action, reason }) => ({ action, reason })), [
      { action: 'auth.refresh_blocked', reason: '{"limit":"invalid"}' },
    ]);
  });

  it('login vẫn giới hạn 20 request/phút/IP, độc lập với refresh', async () => {
    // Các test trước đã dùng một phần hạn mức login của IP; bơm đến khi chạm trần.
    let res = await login('third@aura.local', 'Passw0rd!');
    for (let i = 0; i < 25 && res.status !== 429; i++) res = await login('third@aura.local', 'Passw0rd!');
    assert.equal(res.status, 429);
    assert.ok(Number(res.headers['retry-after']) >= 1);
    await refresh('fam-calm').expect(200);
  });

  it('trần theo IP (300/phút) cho mọi request refresh: chạm trần thì 429, audit limit=ip', async () => {
    audits.length = 0;
    let res = await refresh('fam-cap-0');
    for (let i = 1; i <= 300 && res.status !== 429; i++) res = await refresh(`fam-cap-${i}`);
    assert.equal(res.status, 429);
    assert.deepEqual(audits.map(({ action, reason }) => ({ action, reason })), [
      { action: 'auth.refresh_blocked', reason: '{"limit":"ip"}' },
    ]);
  });
});
