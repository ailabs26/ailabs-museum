import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
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
import { AuditService } from '../../audit/services/audit.service';
import { AuthService } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';
import { TokenService } from '../services/token.service';

const COOKIE = 'aura_rt';
const USER = { id: 'u1', email: 'admin@aura.local', displayName: 'Admin', roles: ['admin'], permissions: [] };

describe('AuthController HTTP — refresh cookie', () => {
  let app: INestApplication;
  const calls: Array<[string, unknown]> = [];

  before(async () => {
    const auth = {
      login: async (dto: unknown) => {
        calls.push(['login', dto]);
        return { accessToken: 'acc', refreshToken: 'rt-1', user: USER };
      },
      refresh: async (raw?: string) => {
        calls.push(['refresh', raw]);
        if (raw !== 'rt-1') throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
        return { accessToken: 'acc-2', refreshToken: 'rt-2' };
      },
      logout: async (raw?: string) => void calls.push(['logout', raw]),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] })],
      controllers: [AuthController],
      providers: [
        RefreshCookieOriginGuard,
        AuthRateLimiter,
        { provide: AuditService, useValue: { recordSafely: async () => undefined } },
        { provide: SessionsService, useValue: {} },
        { provide: AuthService, useValue: auth },
        {
          provide: TokenService,
          useValue: {
            refreshCookieMaxAgeMs: () => 7 * 24 * 3600 * 1000,
            // Token không tồn tại → không có phiên (đếm theo IP); còn lại thuộc một phiên.
            findSessionOwner: async (raw: string) => (raw === 'stolen' ? null : { familyId: 'fam-1', userId: 'u1' }),
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

  it('POST /auth/login: 400 khi body sai định dạng, service không bị gọi', async () => {
    calls.length = 0;
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'x', password: '1' }).expect(400);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.c', password: 'Passw0rd!', role: 'admin' })
      .expect(400);
    assert.deepEqual(calls, []);
  });

  it('POST /auth/login: refresh token chỉ nằm trong cookie HttpOnly, SameSite=Lax, không lộ trong body', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@aura.local', password: 'Passw0rd!' })
      .expect(200);
    assert.deepEqual(res.body.data, { accessToken: 'acc', user: USER });
    assert.equal(JSON.stringify(res.body).includes('rt-1'), false);
    const cookie = String(res.headers['set-cookie']);
    assert.match(cookie, new RegExp(`^${COOKIE}=rt-1;`));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=604800/);
    assert.match(cookie, /Path=\//);
  });

  it('POST /auth/refresh: xoay vòng cookie khi hợp lệ', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${COOKIE}=rt-1`)
      .expect(200);
    assert.deepEqual(res.body.data, { accessToken: 'acc-2' });
    assert.match(String(res.headers['set-cookie']), new RegExp(`^${COOKIE}=rt-2;`));
  });

  it('POST /auth/refresh: 401 thì xóa cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${COOKIE}=stolen`)
      .expect(401);
    assert.match(String(res.headers['set-cookie']), new RegExp(`^${COOKIE}=;.*Expires=Thu, 01 Jan 1970`));
  });

  it('POST /auth/refresh: 403 với Origin lạ (CSRF), không chạm service', async () => {
    calls.length = 0;
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Cookie', `${COOKIE}=rt-1`)
      .expect(403);
    assert.deepEqual(calls, []);
  });

  it('POST /auth/logout: thu hồi và xóa cookie, gọi lại vẫn 200', async () => {
    calls.length = 0;
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `${COOKIE}=rt-2`)
      .expect(200);
    assert.deepEqual(res.body, { success: true, data: null, message: null });
    assert.match(String(res.headers['set-cookie']), new RegExp(`^${COOKIE}=;`));
    await request(app.getHttpServer()).post('/auth/logout').expect(200);
    assert.deepEqual(calls, [['logout', 'rt-2'], ['logout', undefined]]);
  });
});
