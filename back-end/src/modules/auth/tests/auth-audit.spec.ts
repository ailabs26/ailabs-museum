import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { appConfig, jwtConfig } from '../../../config';
import type { RecordAuditInput } from '../../audit/services/audit.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuthController } from '../controllers/auth.controller';
import { LoginFailedException } from '../exceptions/login-failed.exception';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { AuthService } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';
import { TokenService } from '../services/token.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0';

describe('Audit đăng nhập / đăng xuất (AuthController)', () => {
  let app: INestApplication;
  let limiter: AuthRateLimiter;
  const recorded: RecordAuditInput[] = [];

  before(async () => {
    const auth = {
      login: async (dto: { email: string; password: string }) => {
        if (dto.email === 'ghost@aura.local') throw new LoginFailedException('unknown_account', null);
        if (dto.email === 'locked@aura.local') throw new LoginFailedException('account_disabled', USER_ID, 'Tài khoản đã bị khóa');
        if (dto.password !== 'Passw0rd!') throw new LoginFailedException('invalid_password', USER_ID);
        return { accessToken: 'acc', refreshToken: 'rt', user: { id: USER_ID, email: dto.email, displayName: 'A', roles: [], permissions: [] } };
      },
      logout: async (raw?: string) => (raw === 'rt-live' ? USER_ID : null),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] })],
      controllers: [AuthController],
      providers: [
        RefreshCookieOriginGuard,
        AuthRateLimiter,
        { provide: AuditService, useValue: { recordSafely: async (input: RecordAuditInput) => void recorded.push(input) } },
        { provide: SessionsService, useValue: {} },
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
    limiter = app.get(AuthRateLimiter);
  });

  beforeEach(() => {
    recorded.length = 0;
  });

  after(async () => {
    await app?.close();
  });

  const login = (email: string, password = 'Passw0rd!') =>
    request(app.getHttpServer()).post('/auth/login').set('User-Agent', UA).set('X-Request-Id', 'req-1').send({ email, password });

  it('đăng nhập thành công → auth.login: actor = tài khoản, kèm IP, User-Agent, request id', async () => {
    await login('ok@aura.local').expect(200);
    assert.equal(recorded.length, 1);
    const [event] = recorded;
    assert.equal(event.action, 'auth.login');
    assert.equal(event.actorId, USER_ID);
    assert.equal(event.resourceType, 'user');
    assert.equal(event.resourceId, USER_ID);
    assert.equal(event.userAgent, UA);
    assert.equal(event.requestId, 'req-1');
    assert.match(String(event.ip), /127\.0\.0\.1|::1/);
    assert.equal(event.reason, null);
  });

  it('sai mật khẩu / tài khoản khóa → auth.login_failed gắn tài khoản đích, actor rỗng, không lộ email hay mật khẩu', async () => {
    await login('wrong@aura.local', 'sai-mat-khau').expect(401);
    await login('locked@aura.local').expect(401);
    assert.deepEqual(recorded.map((e) => [e.action, e.actorId, e.resourceId, e.reason]), [
      ['auth.login_failed', null, USER_ID, '{"reason":"invalid_password"}'],
      ['auth.login_failed', null, USER_ID, '{"reason":"account_disabled"}'],
    ]);
    const serialized = JSON.stringify(recorded);
    for (const secret of ['sai-mat-khau', 'Passw0rd!', 'wrong@aura.local', 'locked@aura.local']) {
      assert.equal(serialized.includes(secret), false, `audit chứa ${secret}`);
    }
  });

  it('email không tồn tại → auth.login_failed không gắn tài nguyên (resourceId null, không id giả); phản hồi vẫn là thông điệp chung', async () => {
    const res = await login('ghost@aura.local').expect(401);
    assert.equal(res.body.message, 'Email hoặc mật khẩu không đúng');
    assert.deepEqual(recorded.map((e) => [e.action, e.resourceId, e.reason]), [['auth.login_failed', null, '{"reason":"unknown_account"}']]);
  });

  it('bị chặn vì sai quá nhiều lần → auth.login_blocked chỉ ghi 1 lần mỗi cửa sổ dù bị chặn nhiều request', async () => {
    for (let i = 0; i < 5; i++) await login('victim@aura.local', 'sai-mat-khau').expect(401);
    recorded.length = 0;
    await login('victim@aura.local').expect(429);
    await login('victim@aura.local').expect(429);
    await login('victim@aura.local').expect(429);
    assert.deepEqual(recorded.map((e) => [e.action, e.resourceId, e.reason]), [['auth.login_blocked', null, '{"limit":"email"}']]);
    assert.equal(limiter.shouldAuditBlock('email', 'VICTIM@aura.local'), false, 'cùng email (không phân biệt hoa thường) trong cửa sổ');
  });

  it('đăng xuất có phiên → auth.logout; không có cookie/phiên → không ghi', async () => {
    await request(app.getHttpServer()).post('/auth/logout').set('Cookie', 'aura_rt=rt-live').expect(200);
    await request(app.getHttpServer()).post('/auth/logout').expect(200);
    await request(app.getHttpServer()).post('/auth/logout').set('Cookie', 'aura_rt=rt-unknown').expect(200);
    assert.deepEqual(recorded.map((e) => [e.action, e.actorId, e.resourceId]), [['auth.logout', USER_ID, USER_ID]]);
  });
});
