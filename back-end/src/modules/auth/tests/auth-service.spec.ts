import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { PasswordService } from '../../../common/security/password.service';
import { User, UserStatus } from '../../users/entities/user.entity';
import { UsersRepository } from '../../users/repositories/users.repository';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'admin@aura.local',
    displayName: 'Admin',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    userRoles: [{ role: { code: 'admin', rolePermissions: [{ permission: { code: 'user:read' } }] } }],
    ...overrides,
  } as unknown as User;
}

const MANAGER = { tag: 'tx' } as unknown as EntityManager;

function makeService(options: { user?: User | null; passwordOk?: boolean; freshUser?: User | null } = {}) {
  const compared: Array<string | undefined> = [];
  const revoked: string[] = [];
  const log: string[] = [];
  const current = () => (options.user === undefined ? makeUser() : options.user);
  const users = {
    findByEmailWithAccess: async () => current(),
    findByIdWithAccess: async (_id: string, manager?: EntityManager) => {
      if (manager === MANAGER) {
        log.push('reload:tx');
        return options.freshUser === undefined ? current() : options.freshUser;
      }
      return current();
    },
  } as unknown as UsersRepository;
  const sessions = {
    lockUser: async (userId: string, manager: EntityManager, exclusive = false) => {
      assert.equal(manager, MANAGER);
      log.push(`lockUser:${userId}:${exclusive ? 'x' : 'shared'}`);
    },
  } as unknown as RefreshSessionsRepository;
  const tx = { run: async <T>(work: (manager: EntityManager) => Promise<T>) => work(MANAGER) } as unknown as TransactionManager;
  const passwords = {
    compare: async (_plain: string, hash?: string) => {
      compared.push(hash);
      return options.passwordOk ?? true;
    },
  } as unknown as PasswordService;
  const tokens = {
    signAccess: async (_user: unknown, sid: string) => {
      log.push(`sign:${sid}`);
      return 'access-token';
    },
    issueRefresh: async (_userId: string, _family: unknown, manager: EntityManager, client: { userAgent?: string }) => {
      assert.equal(manager, MANAGER, 'phát hành refresh phải nằm trong transaction');
      log.push(`issue:${client?.userAgent ?? '-'}`);
      return { raw: 'refresh-raw', session: { familyId: 'fam-1' } };
    },
    rotate: async (raw: string) => ({ accessToken: `access-for-${raw}`, raw: `next-${raw}` }),
    revokeByRaw: async (raw: string) => void revoked.push(raw),
  } as unknown as TokenService;
  return { service: new AuthService(users, passwords, tokens, tx, sessions), compared, revoked, log };
}

describe('AuthService', () => {
  it('login thành công trả access token, refresh token và AuthUser (không có passwordHash)', async () => {
    const { service } = makeService();
    const result = await service.login({ email: 'admin@aura.local', password: 'Passw0rd!' });
    assert.equal(result.accessToken, 'access-token');
    assert.equal(result.refreshToken, 'refresh-raw');
    assert.deepEqual(result.user, {
      id: 'user-1',
      email: 'admin@aura.local',
      displayName: 'Admin',
      roles: ['admin'],
      permissions: ['user:read'],
    });
    assert.equal('passwordHash' in result.user, false);
  });

  it('login: khóa user (shared) → đọc lại → phát hành trong transaction → ký access với sid = familyId', async () => {
    const { service, log } = makeService();
    await service.login({ email: 'admin@aura.local', password: 'Passw0rd!' }, { userAgent: 'UA' });
    assert.deepEqual(log, ['lockUser:user-1:shared', 'reload:tx', 'issue:UA', 'sign:fam-1']);
  });

  for (const [name, freshUser] of [
    ['Admin vừa đổi mật khẩu', makeUser({ passwordHash: 'new-hash' })],
    ['Admin vừa khóa', makeUser({ status: UserStatus.DISABLED })],
    ['vừa bị xóa', null],
  ] as const) {
    it(`login: ${name} trong lúc so bcrypt → 401, không cấp phiên`, async () => {
      const { service, log } = makeService({ freshUser });
      await assert.rejects(service.login({ email: 'a@b.c', password: 'Passw0rd!' }), UnauthorizedException);
      assert.equal(log.some((entry) => entry.startsWith('issue') || entry.startsWith('sign')), false);
    });
  }

  it('sai mật khẩu → 401 thông điệp chung', async () => {
    const { service } = makeService({ passwordOk: false });
    await assert.rejects(service.login({ email: 'a@b.c', password: 'x'.repeat(8) }), (error: unknown) =>
      error instanceof UnauthorizedException && error.message === 'Email hoặc mật khẩu không đúng');
  });

  it('email không tồn tại → vẫn so khớp bcrypt (chống dò user qua thời gian) rồi 401 cùng thông điệp', async () => {
    const { service, compared } = makeService({ user: null, passwordOk: false });
    await assert.rejects(service.login({ email: 'ghost@b.c', password: 'x'.repeat(8) }), (error: unknown) =>
      error instanceof UnauthorizedException && error.message === 'Email hoặc mật khẩu không đúng');
    assert.deepEqual(compared, [undefined]);
  });

  it('tài khoản bị khóa → 401 dù đúng mật khẩu', async () => {
    const { service } = makeService({ user: makeUser({ status: UserStatus.DISABLED }) });
    await assert.rejects(service.login({ email: 'a@b.c', password: 'x'.repeat(8) }), /Tài khoản đã bị khóa/);
  });

  it('refresh: thiếu cookie → 401; có cookie → xoay vòng', async () => {
    const { service } = makeService();
    await assert.rejects(service.refresh(undefined), UnauthorizedException);
    assert.deepEqual(await service.refresh('r1'), { accessToken: 'access-for-r1', refreshToken: 'next-r1' });
  });

  it('me: user hoạt động trả AuthUser; bị khóa/không tồn tại → 401', async () => {
    assert.equal((await makeService().service.me('user-1')).id, 'user-1');
    await assert.rejects(makeService({ user: null }).service.me('x'), UnauthorizedException);
    await assert.rejects(
      makeService({ user: makeUser({ status: UserStatus.DISABLED }) }).service.me('x'),
      UnauthorizedException,
    );
  });

  it('logout: idempotent khi không có cookie, có cookie thì thu hồi', async () => {
    const { service, revoked } = makeService();
    await service.logout(undefined);
    await service.logout('r1');
    assert.deepEqual(revoked, ['r1']);
  });
});

describe('RefreshCookieOriginGuard', () => {
  const guard = new RefreshCookieOriginGuard({
    getOrThrow: () => 'http://localhost:5173/app',
  } as unknown as ConfigService);

  function ctx(headers: Record<string, string>, protocol = 'http'): ExecutionContext {
    const request = { protocol, get: (name: string) => headers[name.toLowerCase()] };
    return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  }

  it('cho qua client không gửi Origin (CLI/native)', () => {
    assert.equal(guard.canActivate(ctx({ host: 'api.local:3001' })), true);
  });

  it('cho qua Origin của front-end (so theo origin, bỏ path)', () => {
    assert.equal(guard.canActivate(ctx({ origin: 'http://localhost:5173', host: 'api.local:3001' })), true);
  });

  it('cho qua Origin trùng chính API', () => {
    assert.equal(guard.canActivate(ctx({ origin: 'https://api.local:3001', host: 'api.local:3001' }, 'https')), true);
  });

  for (const origin of ['https://evil.example', 'http://localhost:5174', 'https://localhost:5173', 'null']) {
    it(`403 với Origin lạ: ${origin}`, () => {
      assert.throws(() => guard.canActivate(ctx({ origin, host: 'api.local:3001' })), ForbiddenException);
    });
  }
});
