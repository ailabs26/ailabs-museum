import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { TransactionManager } from '../../../common/database/transaction.manager';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import type { PasswordService } from '../../../common/security/password.service';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { appConfig, jwtConfig } from '../../../config';
import { User, UserStatus } from '../../users/entities/user.entity';
import type { UsersRepository } from '../../users/repositories/users.repository';
import { AuthController } from '../controllers/auth.controller';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { AuthService } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';
import { TokenService } from '../services/token.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1', email: 'editor@aura.local', displayName: 'Tên cũ', passwordHash: 'hash', status: UserStatus.ACTIVE,
    userRoles: [{ role: { code: 'editor', rolePermissions: [{ permission: { code: 'room:read' } }] } }],
    ...overrides,
  } as unknown as User;
}

describe('AuthService.updateProfile', () => {
  function harness(user: User | null) {
    const updates: Array<[string, Partial<User>]> = [];
    const users = {
      findByIdWithAccess: async () => user,
      update: async (id: string, patch: Partial<User>) => {
        updates.push([id, patch]);
        if (user) Object.assign(user, patch);
      },
    } as unknown as UsersRepository;
    const service = new AuthService(users, {} as PasswordService, {} as TokenService, {} as TransactionManager, {} as RefreshSessionsRepository);
    return { service, updates };
  }

  it('chỉ đổi displayName của chính user, trả AuthUser mới (không lộ passwordHash)', async () => {
    const { service, updates } = harness(makeUser());
    const result = await service.updateProfile('user-1', { displayName: 'Tên mới' });
    assert.deepEqual(updates, [['user-1', { displayName: 'Tên mới' }]]);
    assert.equal(result.displayName, 'Tên mới');
    assert.deepEqual(result.roles, ['editor']);
    assert.equal('passwordHash' in result, false);
  });

  it('tài khoản bị khóa hoặc không còn → 401, không ghi gì', async () => {
    for (const user of [makeUser({ status: UserStatus.DISABLED }), null]) {
      const { service, updates } = harness(user);
      await assert.rejects(service.updateProfile('user-1', { displayName: 'X' }), UnauthorizedException);
      assert.deepEqual(updates, []);
    }
  });
});

describe('AuthController HTTP — PATCH /auth/me', () => {
  const SECRET = 'auth-profile-spec-secret-0123456789';
  let app: INestApplication;
  let jwt: JwtService;
  const calls: Array<[string, unknown]> = [];

  before(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    const auth = {
      updateProfile: async (userId: string, dto: { displayName: string }) => {
        calls.push([userId, { ...dto }]);
        return { id: userId, email: 'e@aura.local', displayName: dto.displayName, roles: [], permissions: [] } satisfies AuthUser;
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] }), JwtModule.register({})],
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

  const patch = async (body: object, status: number) => {
    const token = await jwt.signAsync(
      { sub: 'user-1', email: 'e@aura.local', displayName: 'Cũ', roles: [], permissions: [], sid: 'fam-1' },
      { secret: SECRET, expiresIn: '5m' },
    );
    return request(app.getHttpServer()).patch('/auth/me').set('Authorization', `Bearer ${token}`).send(body).expect(status);
  };

  it('401 khi chưa đăng nhập', async () => {
    await request(app.getHttpServer()).patch('/auth/me').send({ displayName: 'X' }).expect(401);
  });

  it('400 khi tên rỗng (sau trim), quá 160 ký tự hoặc gửi kèm trường không được sửa; service không bị gọi', async () => {
    calls.length = 0;
    await patch({ displayName: '   ' }, 400);
    await patch({ displayName: 'x'.repeat(161) }, 400);
    await patch({ displayName: 'Hợp lệ', email: 'hack@aura.local' }, 400);
    await patch({ displayName: 'Hợp lệ', roles: ['admin'] }, 400);
    assert.deepEqual(calls, []);
  });

  it('200 → AuthUser mới; tên được trim; luôn là user của token (không truyền id từ body)', async () => {
    calls.length = 0;
    const res = await patch({ displayName: '  Nguyễn Văn A  ' }, 200);
    assert.equal(res.body.data.displayName, 'Nguyễn Văn A');
    assert.deepEqual(calls, [['user-1', { displayName: 'Nguyễn Văn A' }]]);
  });
});
