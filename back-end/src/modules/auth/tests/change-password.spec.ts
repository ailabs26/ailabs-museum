import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  BadRequestException, ConflictException, INestApplication, UnauthorizedException, ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { PasswordService } from '../../../common/security/password.service';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { appConfig, jwtConfig } from '../../../config';
import { User, UserStatus } from '../../users/entities/user.entity';
import { UsersRepository } from '../../users/repositories/users.repository';
import { AuthController } from '../controllers/auth.controller';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuthService } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';
import { TokenService } from '../services/token.service';

const MANAGER = { tag: 'tx' } as unknown as EntityManager;
const ACTOR: AuthUser = {
  id: 'user-1', email: 'editor@aura.local', displayName: 'E', roles: [], permissions: [], sessionId: 'fam-current',
};
const DTO: ChangePasswordDto = { currentPassword: 'Old-Passw0rd', newPassword: 'New-Passw0rd' };

/** Mật khẩu giả: hash = `hash(<plain>)` để so khớp xác định. */
function harness(options: { status?: UserStatus; freshHash?: string; freshMissing?: boolean } = {}) {
  const log: string[] = [];
  const stored = { passwordHash: 'hash(Old-Passw0rd)' };
  const makeUser = (passwordHash: string) =>
    ({ id: 'user-1', email: ACTOR.email, passwordHash, status: options.status ?? UserStatus.ACTIVE }) as unknown as User;
  let inTx = false;
  const users = {
    findByIdWithAccess: async (_id: string, manager?: EntityManager) => {
      if (manager === MANAGER) {
        log.push('reload');
        return options.freshMissing ? null : makeUser(options.freshHash ?? stored.passwordHash);
      }
      return makeUser(stored.passwordHash);
    },
    update: async (_id: string, patch: Partial<User>, manager: EntityManager) => {
      assert.ok(inTx && manager === MANAGER, 'ghi mật khẩu phải trong transaction');
      log.push(`update:${patch.passwordHash}`);
      stored.passwordHash = patch.passwordHash!;
    },
  } as unknown as UsersRepository;
  const passwords = {
    compare: async (plain: string, hash?: string) => hash === `hash(${plain})`,
    hash: async (plain: string) => `hash(${plain})`,
  } as unknown as PasswordService;
  const sessions = {
    lockUser: async (_id: string, manager: EntityManager, exclusive = false) => {
      assert.ok(inTx && manager === MANAGER);
      log.push(`lock:${exclusive ? 'x' : 'shared'}`);
    },
    revokeAllForUser: async (userId: string, manager: EntityManager, except?: string) => {
      assert.ok(inTx && manager === MANAGER);
      log.push(`revokeAll:${userId}:except=${except}`);
    },
  } as unknown as RefreshSessionsRepository;
  const tx = {
    run: async <T>(work: (manager: EntityManager) => Promise<T>) => {
      inTx = true;
      try {
        return await work(MANAGER);
      } finally {
        inTx = false;
      }
    },
  } as unknown as TransactionManager;
  const service = new AuthService(users, passwords, {} as TokenService, tx, sessions);
  return { service, log, stored };
}

describe('AuthService.changePassword', () => {
  it('đúng mật khẩu hiện tại → khóa user (độc quyền), đọc lại, ghi hash mới, đăng xuất thiết bị khác trừ phiên hiện tại', async () => {
    const { service, log, stored } = harness();
    await service.changePassword(ACTOR, DTO);
    assert.deepEqual(log, ['lock:x', 'reload', 'update:hash(New-Passw0rd)', 'revokeAll:user-1:except=fam-current']);
    assert.equal(stored.passwordHash, 'hash(New-Passw0rd)');
  });

  it('sai mật khẩu hiện tại → WrongCurrentPasswordException (400, gắn field), không ghi gì', async () => {
    const { service, log } = harness();
    await assert.rejects(service.changePassword(ACTOR, { ...DTO, currentPassword: 'wrong' }), (error: unknown) => {
      assert.ok(error instanceof WrongCurrentPasswordException);
      assert.equal(error.getStatus(), 400, 'không được là 401 — frontend sẽ đăng xuất người dùng');
      return true;
    });
    assert.deepEqual(log, []);
  });

  it('mật khẩu mới trùng mật khẩu hiện tại → 400, không ghi gì', async () => {
    const { service, log } = harness();
    await assert.rejects(service.changePassword(ACTOR, { ...DTO, newPassword: DTO.currentPassword }), BadRequestException);
    assert.deepEqual(log, []);
  });

  it('tài khoản bị khóa → 401, không ghi gì', async () => {
    const { service, log } = harness({ status: UserStatus.DISABLED });
    await assert.rejects(service.changePassword(ACTOR, DTO), UnauthorizedException);
    assert.deepEqual(log, []);
  });

  for (const [name, options] of [
    ['Admin vừa đặt lại mật khẩu', { freshHash: 'hash(Admin-Reset1)' }],
    ['tài khoản vừa bị xóa', { freshMissing: true }],
  ] as const) {
    it(`${name} trong lúc so bcrypt → 409, không ghi đè và không thu hồi phiên`, async () => {
      const { service, log } = harness(options);
      await assert.rejects(service.changePassword(ACTOR, DTO), ConflictException);
      assert.deepEqual(log, ['lock:x', 'reload']);
    });
  }
});

describe('AuthController HTTP — POST /auth/change-password', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const calls: string[] = [];
  const SECRET = 'change-password-spec-secret-012345';

  before(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    const auth = {
      changePassword: async (user: AuthUser, dto: ChangePasswordDto) => {
        calls.push(`${user.id}:${user.sessionId}`);
        if (dto.currentPassword !== 'Old-Passw0rd') throw new WrongCurrentPasswordException();
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: ActiveSessionGuard },
        { provide: RefreshSessionsRepository, useValue: { isFamilyLive: async () => true } },
        { provide: SessionsService, useValue: {} },
        { provide: AuthService, useValue: auth },
        { provide: TokenService, useValue: { refreshCookieMaxAgeMs: () => 1000 } },
        RefreshCookieOriginGuard,
        AuthRateLimiter,
        { provide: AuditService, useValue: { recordSafely: async () => undefined } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = app.get(JwtService);
  });

  after(async () => {
    await app?.close();
  });

  const token = (email: string) => jwt.signAsync(
    { sub: 'user-1', email, displayName: 'E', roles: [], permissions: [], sid: 'fam-current' },
    { secret: SECRET, expiresIn: '5m' },
  );
  const change = async (email: string, body: object, status: number) =>
    request(app.getHttpServer()).post('/auth/change-password')
      .set('Authorization', `Bearer ${await token(email)}`).send(body).expect(status);

  it('401 khi không đăng nhập', async () => {
    await request(app.getHttpServer()).post('/auth/change-password').send(DTO).expect(401);
  });

  it('400 khi mật khẩu mới < 8 ký tự hoặc thiếu trường, service không bị gọi', async () => {
    calls.length = 0;
    await change('a@aura.local', { currentPassword: 'Old-Passw0rd', newPassword: 'short' }, 400);
    await change('a@aura.local', { newPassword: 'New-Passw0rd' }, 400);
    assert.deepEqual(calls, []);
  });

  it('thành công → 200 { id }, truyền đúng user + phiên hiện tại cho service', async () => {
    calls.length = 0;
    const res = await change('ok@aura.local', DTO, 200);
    assert.deepEqual(res.body.data, { id: 'user-1' });
    assert.deepEqual(calls, ['user-1:fam-current']);
  });

  it('sai mật khẩu hiện tại → 400 có lỗi field currentPassword; 5 lần sai → 429 + Retry-After, service không bị gọi', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await change('guess@aura.local', { ...DTO, currentPassword: 'wrong-guess' }, 400);
      assert.equal(res.body.errors[0].field, 'currentPassword');
    }
    calls.length = 0;
    const blocked = await change('guess@aura.local', DTO, 429);
    assert.ok(Number(blocked.headers['retry-after']) >= 1);
    assert.deepEqual(calls, []);
  });
});
