import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { HttpException, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { appConfig, jwtConfig } from '../../../config';
import { AuthController } from '../controllers/auth.controller';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { AuthService } from '../services/auth.service';
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

describe('AuthController HTTP — rate limit', () => {
  let app: INestApplication;
  let loginCalls = 0;

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
        { provide: AuthService, useValue: auth },
        { provide: TokenService, useValue: { refreshCookieMaxAgeMs: () => 1000 } },
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

  it('vượt 20 request/phút từ một IP → 429 cho cả login lẫn refresh', async () => {
    // Các test trước đã dùng một phần hạn mức IP; bơm đến khi chạm trần.
    let res = await request(app.getHttpServer()).post('/auth/refresh');
    for (let i = 0; i < 25 && res.status !== 429; i++) {
      res = await request(app.getHttpServer()).post('/auth/refresh');
    }
    assert.equal(res.status, 429);
    assert.ok(Number(res.headers['retry-after']) >= 1);
    await login('third@aura.local', 'Passw0rd!').expect(429);
  });
});
