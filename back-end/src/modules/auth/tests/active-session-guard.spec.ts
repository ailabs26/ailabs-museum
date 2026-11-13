import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';

const USER: AuthUser = { id: 'u1', email: 'a@b.c', displayName: 'A', roles: [], permissions: [] };

function setup(live: string[]) {
  const checked: string[] = [];
  const sessions = {
    isFamilyLive: async (familyId: string) => {
      checked.push(familyId);
      return live.includes(familyId);
    },
  } as unknown as RefreshSessionsRepository;
  let isPublic = false;
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const guard = new ActiveSessionGuard(reflector, sessions);
  const ctx = (user?: AuthUser) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;
  return { guard, ctx, checked, setPublic: () => void (isPublic = true) };
}

describe('ActiveSessionGuard', () => {
  it('route @Public() bỏ qua, không tra DB', async () => {
    const { guard, ctx, checked, setPublic } = setup([]);
    setPublic();
    assert.equal(await guard.canActivate(ctx()), true);
    assert.deepEqual(checked, []);
  });

  it('phiên còn sống → cho qua', async () => {
    const { guard, ctx, checked } = setup(['fam-1']);
    assert.equal(await guard.canActivate(ctx({ ...USER, sessionId: 'fam-1' })), true);
    assert.deepEqual(checked, ['fam-1']);
  });

  it('phiên đã bị đăng xuất/thu hồi → 401', async () => {
    const { guard, ctx } = setup(['fam-1']);
    await assert.rejects(guard.canActivate(ctx({ ...USER, sessionId: 'fam-2' })), UnauthorizedException);
  });

  it('token không có sid (phát hành trước khi có guard) hoặc thiếu user → 401, không tra DB', async () => {
    const { guard, ctx, checked } = setup(['fam-1']);
    await assert.rejects(guard.canActivate(ctx(USER)), UnauthorizedException);
    await assert.rejects(guard.canActivate(ctx()), UnauthorizedException);
    assert.deepEqual(checked, []);
  });
});
