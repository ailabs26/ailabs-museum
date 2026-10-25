import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
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
import type { AuthUser } from '../../../common/types/auth-user.type';
import { appConfig, jwtConfig } from '../../../config';
import { AuthController } from '../controllers/auth.controller';
import type { RefreshSession } from '../entities/refresh-session.entity';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { AuthService } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';
import { TokenService } from '../services/token.service';

const SECRET = 'auth-sessions-spec-secret-0123456789';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const CURRENT = '22222222-2222-4222-8222-222222222222';
const OTHER = '44444444-4444-4444-8444-444444444444';
const STRANGER = '55555555-5555-4555-8555-555555555555';
const COOKIE = 'aura_rt';
const MANAGER = {} as EntityManager;

/** Repo trong bộ nhớ: family → { userId, revoked }. */
function memoryRepo() {
  const families = new Map<string, { userId: string; revoked: boolean }>();
  const row = (familyId: string, createdAt: string): RefreshSession => ({
    familyId, userAgent: 'UA', ip: '1.1.1.1', signedInAt: new Date('2026-10-01T00:00:00Z'),
    createdAt: new Date(createdAt), expiresAt: new Date('2026-11-01T00:00:00Z'),
  }) as RefreshSession;
  const repo = {
    isFamilyLive: async (familyId: string) => families.get(familyId)?.revoked === false,
    listLiveForUser: async (userId: string) =>
      [...families].filter(([, f]) => f.userId === userId && !f.revoked)
        .map(([id], i) => row(id, `2026-10-2${i}T00:00:00Z`)),
    revokeFamilyOfUser: async (userId: string, familyId: string) => {
      const family = families.get(familyId);
      if (!family || family.userId !== userId || family.revoked) return false;
      family.revoked = true;
      return true;
    },
    revokeAllForUser: async (userId: string, _m: EntityManager, except?: string) => {
      for (const [id, family] of families) if (family.userId === userId && id !== except) family.revoked = true;
    },
  } as unknown as RefreshSessionsRepository;
  const reset = () => {
    families.clear();
    families.set(CURRENT, { userId: USER_ID, revoked: false });
    families.set(OTHER, { userId: USER_ID, revoked: false });
    families.set(STRANGER, { userId: 'someone-else', revoked: false });
  };
  reset();
  return { repo, families, reset };
}

describe('SessionsService', () => {
  const tx = { run: <T>(work: (m: EntityManager) => Promise<T>) => work(MANAGER) } as unknown as TransactionManager;
  const user: AuthUser = { id: USER_ID, email: 'a@b.c', displayName: 'A', roles: [], permissions: [], sessionId: CURRENT };

  it('list đánh dấu phiên hiện tại, không lộ token hash', async () => {
    const { repo } = memoryRepo();
    const list = await new SessionsService(repo, tx).list(user);
    assert.deepEqual(list.map((s) => [s.id, s.current]), [[CURRENT, true], [OTHER, false]]);
    assert.equal(JSON.stringify(list).includes('tokenHash'), false);
    assert.deepEqual(Object.keys(list[0]).sort(), ['current', 'expiresAt', 'id', 'ip', 'lastActiveAt', 'signedInAt', 'userAgent']);
  });

  it('revoke phiên người khác hoặc không tồn tại → 404, không đụng tới phiên đó', async () => {
    const { repo, families } = memoryRepo();
    const service = new SessionsService(repo, tx);
    await assert.rejects(service.revoke(user, STRANGER), NotFoundException);
    assert.equal(families.get(STRANGER)!.revoked, false);
    assert.equal(await service.revoke(user, OTHER), false);
    assert.equal(await service.revoke(user, CURRENT), true, 'thu hồi phiên hiện tại → controller xóa cookie');
  });
});

describe('AuthController HTTP — phiên đăng nhập', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const memory = memoryRepo();

  before(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    const tx = { run: <T>(work: (m: EntityManager) => Promise<T>) => work(MANAGER) } as unknown as TransactionManager;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: ActiveSessionGuard },
        { provide: RefreshSessionsRepository, useValue: memory.repo },
        { provide: SessionsService, useFactory: () => new SessionsService(memory.repo, tx) },
        RefreshCookieOriginGuard,
        AuthRateLimiter,
        { provide: AuthService, useValue: {} },
        { provide: TokenService, useValue: { refreshCookieMaxAgeMs: () => 1000 } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = app.get(JwtService);
  });

  after(async () => {
    await app?.close();
  });

  const token = (sid = CURRENT) =>
    jwt.signAsync({ sub: USER_ID, email: 'a@b.c', displayName: 'A', roles: [], permissions: [], sid }, { secret: SECRET, expiresIn: '5m' });
  const http = () => request(app.getHttpServer());

  it('GET /auth/sessions: 401 khi không có token; có token thì liệt kê thiết bị của chính mình', async () => {
    memory.reset();
    await http().get('/auth/sessions').expect(401);
    const res = await http().get('/auth/sessions').set('Authorization', `Bearer ${await token()}`).expect(200);
    assert.deepEqual(res.body.data.map((s: { id: string }) => s.id), [CURRENT, OTHER]);
  });

  it('DELETE /auth/sessions/:id: id sai định dạng 400; phiên người khác 404', async () => {
    memory.reset();
    const auth = `Bearer ${await token()}`;
    await http().delete('/auth/sessions/not-a-uuid').set('Authorization', auth).expect(400);
    await http().delete(`/auth/sessions/${STRANGER}`).set('Authorization', auth).expect(404);
  });

  it('DELETE thiết bị khác: thiết bị đó bị chặn NGAY ở request kế tiếp, cookie hiện tại giữ nguyên', async () => {
    memory.reset();
    const otherDevice = await token(OTHER);
    await http().get('/auth/sessions').set('Authorization', `Bearer ${otherDevice}`).expect(200);
    const res = await http().delete(`/auth/sessions/${OTHER}`).set('Authorization', `Bearer ${await token()}`).expect(200);
    assert.equal(res.headers['set-cookie'], undefined);
    await http().get('/auth/sessions').set('Authorization', `Bearer ${otherDevice}`).expect(401);
  });

  it('DELETE chính phiên hiện tại → xóa cookie refresh', async () => {
    memory.reset();
    const res = await http().delete(`/auth/sessions/${CURRENT}`).set('Authorization', `Bearer ${await token()}`).expect(200);
    assert.match(String(res.headers['set-cookie']), new RegExp(`^${COOKIE}=;`));
  });

  it('POST /auth/sessions/revoke-others: giữ thiết bị hiện tại, đá thiết bị khác, không đụng user khác', async () => {
    memory.reset();
    const res = await http().post('/auth/sessions/revoke-others').set('Authorization', `Bearer ${await token()}`).expect(200);
    assert.deepEqual(res.body.data, { id: USER_ID });
    assert.deepEqual([...memory.families].map(([id, f]) => [id, f.revoked]), [[CURRENT, false], [OTHER, true], [STRANGER, false]]);
    await http().get('/auth/sessions').set('Authorization', `Bearer ${await token()}`).expect(200);
    await http().get('/auth/sessions').set('Authorization', `Bearer ${await token(OTHER)}`).expect(401);
  });

  it('POST /auth/logout-all: thu hồi mọi thiết bị kể cả hiện tại và xóa cookie', async () => {
    memory.reset();
    const auth = `Bearer ${await token()}`;
    const res = await http().post('/auth/logout-all').set('Authorization', auth).expect(200);
    assert.match(String(res.headers['set-cookie']), new RegExp(`^${COOKIE}=;`));
    await http().get('/auth/sessions').set('Authorization', auth).expect(401);
    assert.equal(memory.families.get(STRANGER)!.revoked, false);
  });
});
