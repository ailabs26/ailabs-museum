import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { BadRequestException, HttpException, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import type { TransactionManager } from '../../../common/database/transaction.manager';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import type { PasswordService } from '../../../common/security/password.service';
import { appConfig, jwtConfig } from '../../../config';
import type { RecordAuditInput } from '../../audit/services/audit.service';
import { AuditService } from '../../audit/services/audit.service';
import { User, UserStatus } from '../../users/entities/user.entity';
import type { UsersRepository } from '../../users/repositories/users.repository';
import { AuthController } from '../controllers/auth.controller';
import { LoginFailedException } from '../exceptions/login-failed.exception';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import type { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { AuthService, type LoginResult, type MfaChallenge } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';
import { TokenService } from '../services/token.service';
import { TwoFactorService } from '../services/two-factor.service';

const SECRET = 'two-factor-login-spec-secret-0123456789';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER = {} as EntityManager;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID, email: 'lan@aura.local', displayName: 'Lan', passwordHash: 'hash-v1', status: UserStatus.ACTIVE,
    totpEnabledAt: new Date(), userRoles: [], ...overrides,
  } as unknown as User;
}

/** AuthService thật + TokenService thật (ký/kiểm JWT), repo/2FA giả. */
function harness(options: { user?: () => User; validCode?: string } = {}) {
  let user = options.user ?? (() => makeUser());
  const config = { getOrThrow: (key: string) => ({ 'jwt.accessSecret': SECRET, 'jwt.accessTtl': '15m' } as Record<string, string>)[key] } as unknown as ConfigService;
  const users = { findByEmailWithAccess: async () => user(), findByIdWithAccess: async () => user() } as unknown as UsersRepository;
  const sessions = { lockUser: async () => undefined } as unknown as RefreshSessionsRepository;
  const tx = { run: <T>(work: (m: EntityManager) => Promise<T>) => work(MANAGER) } as TransactionManager;
  const jwt = new JwtService();
  const tokens = new TokenService(jwt, config, sessions, users, tx);
  (tokens as unknown as { issueRefresh: unknown }).issueRefresh = async () => ({ raw: 'refresh-raw', session: { familyId: 'fam-1' } });
  const codesChecked: unknown[] = [];
  const twoFactor = {
    verifyLoginCode: async (_id: string, codes: { code?: string; recoveryCode?: string }) => {
      codesChecked.push(codes);
      return codes.code === (options.validCode ?? '246810') || codes.recoveryCode === 'abcde-fghij';
    },
  } as unknown as TwoFactorService;
  const passwords = { compare: async () => true } as unknown as PasswordService;
  const limiter = new AuthRateLimiter();
  const service = new AuthService(users, passwords, tokens, tx, sessions, twoFactor, limiter);
  return { service, jwt, limiter, codesChecked, setUser: (next: () => User) => { user = next; } };
}

const challenge = async (service: AuthService) => {
  const result = await service.login({ email: 'lan@aura.local', password: 'x' });
  assert.ok('mfaRequired' in result, 'tài khoản bật 2FA phải nhận challenge');
  return (result as MfaChallenge).mfaToken;
};

describe('AuthService — đăng nhập 2 bước', () => {
  it('chưa bật 2FA → cấp phiên ngay như cũ; đã bật → chỉ trả mfaToken (JWT 5 phút, purpose mfa), chưa cấp phiên', async () => {
    const off = harness({ user: () => makeUser({ totpEnabledAt: null }) });
    const result = await off.service.login({ email: 'lan@aura.local', password: 'x' }) as LoginResult;
    assert.equal(result.refreshToken, 'refresh-raw');

    const on = harness();
    const token = await challenge(on.service);
    const payload = on.jwt.decode(token) as { sub: string; purpose: string; exp: number; iat: number; pwd: string };
    assert.equal(payload.sub, USER_ID);
    assert.equal(payload.purpose, 'mfa');
    assert.equal(payload.exp - payload.iat, 300);
    assert.equal(payload.pwd.length, 16);
    assert.equal(token.includes('hash-v1'), false);
  });

  it('mã đúng (TOTP hoặc mã khôi phục) → cấp phiên', async () => {
    const { service } = harness();
    const viaTotp = await service.loginTwoFactor({ mfaToken: await challenge(service), code: '246810' });
    assert.equal(viaTotp.refreshToken, 'refresh-raw');
    const viaRecovery = await service.loginTwoFactor({ mfaToken: await challenge(service), recoveryCode: 'abcde-fghij' });
    assert.equal(viaRecovery.accessToken.split('.').length, 3);
  });

  it('mã sai → invalid_2fa; sai 5 lần → 429 kể cả khi sau đó nhập đúng; đúng thì đặt lại bộ đếm', async () => {
    const { service } = harness();
    const token = await challenge(service);
    for (let i = 0; i < 5; i++) {
      await assert.rejects(service.loginTwoFactor({ mfaToken: token, code: '000000' }), (e: unknown) =>
        e instanceof LoginFailedException && e.reason === 'invalid_2fa' && e.userId === USER_ID);
    }
    await assert.rejects(service.loginTwoFactor({ mfaToken: token, code: '246810' }), (e: unknown) =>
      e instanceof HttpException && e.getStatus() === 429);
  });

  it('token sai chữ ký / không phải token 2FA / access token thường → mfa_expired', async () => {
    const { service, jwt } = harness();
    const forged = await jwt.signAsync({ sub: USER_ID, purpose: 'mfa', pwd: 'x' }, { secret: 'other-secret-xxxxxxxxxxxxxxxx' });
    const notMfa = await jwt.signAsync({ sub: USER_ID }, { secret: SECRET });
    for (const mfaToken of [forged, notMfa, 'garbage']) {
      await assert.rejects(service.loginTwoFactor({ mfaToken, code: '246810' }), (e: unknown) =>
        e instanceof LoginFailedException && e.reason === 'mfa_expired');
    }
  });

  it('đổi mật khẩu giữa bước 1 và 2 → token mất hiệu lực; tài khoản bị khóa giữa chừng → account_disabled', async () => {
    const h = harness();
    const token = await challenge(h.service);
    h.setUser(() => makeUser({ passwordHash: 'hash-v2' }));
    await assert.rejects(h.service.loginTwoFactor({ mfaToken: token, code: '246810' }), (e: unknown) =>
      e instanceof LoginFailedException && e.reason === 'mfa_expired');

    h.setUser(() => makeUser());
    const fresh = await challenge(h.service);
    h.setUser(() => makeUser({ status: UserStatus.DISABLED }));
    await assert.rejects(h.service.loginTwoFactor({ mfaToken: fresh, code: '246810' }), (e: unknown) =>
      e instanceof UnauthorizedException && (e as LoginFailedException).reason === 'account_disabled');
  });
});

describe('POST /auth/login + /auth/login/2fa (HTTP)', () => {
  let app: INestApplication;
  const recorded: RecordAuditInput[] = [];

  before(async () => {
    const auth = {
      login: async () => ({ mfaRequired: true, mfaToken: 'mfa-token' }),
      loginTwoFactor: async (dto: { code?: string; recoveryCode?: string }) => {
        if (dto.code === '246810' || dto.recoveryCode === 'abcde-fghij') {
          return { accessToken: 'acc', refreshToken: 'rt-new', user: { id: USER_ID, email: 'lan@aura.local', displayName: 'Lan', roles: [], permissions: [] } };
        }
        throw new LoginFailedException('invalid_2fa', USER_ID, 'Mã xác thực không đúng hoặc đã hết hạn');
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] })],
      controllers: [AuthController],
      providers: [
        RefreshCookieOriginGuard, AuthRateLimiter,
        { provide: AuditService, useValue: { recordSafely: async (input: RecordAuditInput) => void recorded.push(input) } },
        { provide: SessionsService, useValue: {} },
        { provide: TwoFactorService, useValue: {} },
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

  beforeEach(() => { recorded.length = 0; });
  after(async () => { await app?.close(); });

  it('bước 1 (bật 2FA): trả mfaRequired + mfaToken, KHÔNG set cookie, chưa ghi auth.login', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: 'lan@aura.local', password: 'Passw0rd!x' }).expect(200);
    assert.deepEqual(res.body.data, { mfaRequired: true, mfaToken: 'mfa-token' });
    assert.equal(res.headers['set-cookie'], undefined);
    assert.deepEqual(recorded, []);
  });

  it('bước 2 đúng mã → set cookie, ghi auth.login kèm cách xác thực; sai mã → 401 + auth.login_failed invalid_2fa', async () => {
    const ok = await request(app.getHttpServer()).post('/auth/login/2fa').send({ mfaToken: 'mfa-token', code: '246 810' }).expect(200);
    assert.match(String(ok.headers['set-cookie']), /aura_rt=rt-new/);
    assert.equal(ok.body.data.accessToken, 'acc');
    await request(app.getHttpServer()).post('/auth/login/2fa').send({ mfaToken: 'mfa-token', code: '000000' }).expect(401);
    assert.deepEqual(recorded.map((e) => [e.action, e.resourceId, e.reason]), [
      ['auth.login', USER_ID, '{"twoFactor":"totp"}'],
      ['auth.login_failed', USER_ID, '{"reason":"invalid_2fa"}'],
    ]);
  });

  it('bước 2: phải có đúng một trong hai (mã 6 số / mã khôi phục); mã không đủ 6 số → 400', async () => {
    const post = (body: object) => request(app.getHttpServer()).post('/auth/login/2fa').send(body);
    await post({ mfaToken: 'mfa-token' }).expect(400);
    await post({ mfaToken: 'mfa-token', code: '246810', recoveryCode: 'abcde-fghij' }).expect(400);
    await post({ mfaToken: 'mfa-token', code: '12345' }).expect(400);
    await post({ mfaToken: 'mfa-token', recoveryCode: 'abcde-fghij' }).expect(200);
  });
});

describe('Quản lý 2FA của tôi (HTTP)', () => {
  let app: INestApplication;
  let limiter: AuthRateLimiter;
  const calls: unknown[][] = [];
  const ME = { id: USER_ID, email: 'lan@aura.local', displayName: 'Lan', roles: [], permissions: [], sessionId: 'fam-1' };

  before(async () => {
    const twoFactor = {
      status: async () => ({ enabled: true, recoveryCodesRemaining: 7 }),
      setup: async () => ({ otpauthUrl: 'otpauth://totp/x', qrDataUrl: 'data:image/png;base64,AA', secret: 'ABC' }),
      enable: async (...args: unknown[]) => { calls.push(['enable', ...args]); return { recoveryCodes: ['aaaaa-bbbbb'] }; },
      disable: async (_user: unknown, password: string, codes: { code?: string }) => {
        calls.push(['disable', password, codes]);
        if (password !== 'right') throw new WrongCurrentPasswordException();
        if (codes.code === '000000') throw new BadRequestException('Mã xác thực không đúng hoặc đã hết hạn');
      },
      regenerateRecoveryCodes: async (_user: unknown, code: string) => {
        if (code !== '135790') throw new BadRequestException('Mã xác thực không đúng hoặc đã hết hạn');
        return { recoveryCodes: ['ccccc-ddddd'] };
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] })],
      controllers: [AuthController],
      providers: [
        RefreshCookieOriginGuard, AuthRateLimiter,
        { provide: AuditService, useValue: { recordSafely: async () => undefined } },
        { provide: SessionsService, useValue: {} },
        { provide: TwoFactorService, useValue: twoFactor },
        { provide: AuthService, useValue: {} },
        { provide: TokenService, useValue: { refreshCookieMaxAgeMs: () => 1000 } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => { req.user = ME; next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    limiter = app.get(AuthRateLimiter);
  });

  beforeEach(() => { calls.length = 0; });
  after(async () => { await app?.close(); });
  const http = () => request(app.getHttpServer());

  it('status / setup / enable: trả đúng dữ liệu; mã có khoảng trắng được chuẩn hóa; enable trả id (audit) + mã khôi phục', async () => {
    assert.deepEqual((await http().get('/auth/2fa').expect(200)).body.data, { enabled: true, recoveryCodesRemaining: 7 });
    assert.equal((await http().post('/auth/2fa/setup').expect(200)).body.data.secret, 'ABC');
    const enabled = await http().post('/auth/2fa/enable').send({ code: '12 34 56' }).expect(200);
    assert.deepEqual(enabled.body.data, { id: USER_ID, recoveryCodes: ['aaaaa-bbbbb'] });
    assert.equal(calls[0][2], '123456');
    await http().post('/auth/2fa/enable').send({ code: 'abc' }).expect(400);
  });

  it('disable: phải có đúng một loại mã; sai mật khẩu tính vào bộ đếm email, sai mã tính vào bộ đếm 2FA → 429', async () => {
    await http().post('/auth/2fa/disable').send({ password: 'right' }).expect(400);
    await http().post('/auth/2fa/disable').send({ password: 'right', code: '111111', recoveryCode: 'aaaaa-bbbbb' }).expect(400);
    assert.deepEqual(calls, [], 'thiếu/thừa mã thì không gọi service');

    for (let i = 0; i < 5; i++) await http().post('/auth/2fa/disable').send({ password: 'right', code: '000000' }).expect(400);
    const blocked = await http().post('/auth/2fa/disable').send({ password: 'right', code: '111111' }).expect(429);
    assert.ok(Number(blocked.headers['retry-after']) > 0);
    limiter.resetMfa(USER_ID);

    for (let i = 0; i < 5; i++) await http().post('/auth/2fa/disable').send({ password: 'wrong', code: '111111' }).expect(400);
    await http().post('/auth/2fa/disable').send({ password: 'right', code: '111111' }).expect(429);
    limiter.resetEmail(ME.email);
    assert.deepEqual((await http().post('/auth/2fa/disable').send({ password: 'right', code: '111111' }).expect(200)).body.data, { id: USER_ID });
  });

  it('recovery-codes: mã đúng → bộ mới + id; sai mã tính vào bộ đếm 2FA', async () => {
    limiter.resetMfa(USER_ID);
    assert.deepEqual((await http().post('/auth/2fa/recovery-codes').send({ code: '135790' }).expect(200)).body.data,
      { id: USER_ID, recoveryCodes: ['ccccc-ddddd'] });
    for (let i = 0; i < 5; i++) await http().post('/auth/2fa/recovery-codes').send({ code: '000000' }).expect(400);
    await http().post('/auth/2fa/recovery-codes').send({ code: '135790' }).expect(429);
  });
});
