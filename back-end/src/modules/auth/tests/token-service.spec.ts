import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { JwtAccessPayload } from '../../../common/types/jwt.payload';
import { User, UserStatus } from '../../users/entities/user.entity';
import { UsersRepository } from '../../users/repositories/users.repository';
import { RefreshSession } from '../entities/refresh-session.entity';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { TokenService } from '../services/token.service';

const SECRET = 'token-service-secret-0123456789';
const CONFIG: Record<string, unknown> = {
  'jwt.accessSecret': SECRET,
  'jwt.accessTtl': '15m',
  'jwt.refreshTtlDays': 7,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

/**
 * Kho session trong bộ nhớ + TransactionManager mô phỏng commit/rollback: thay đổi trong `run`
 * chỉ được giữ khi work không ném lỗi. Nhờ đó kiểm chứng được revoke do reuse/expiry
 * KHÔNG bị rollback (TokenService ném 401 sau khi transaction đã commit).
 */
class InMemorySessions {
  rows = new Map<string, RefreshSession>();
  locks: string[] = [];
  private seq = 0;

  repository(): RefreshSessionsRepository {
    return {
      findByTokenHash: async (hash: string) => [...this.rows.values()].find((row) => row.tokenHash === hash) ?? null,
      lockFamily: async (familyId: string) => void this.locks.push(familyId),
      lockUser: async () => undefined,
      create: async (session: Partial<RefreshSession>) => {
        const row = { id: `s${++this.seq}`, usedAt: null, revokedAt: null, replacedById: null, ...session } as RefreshSession;
        this.rows.set(row.id, row);
        return row;
      },
      markUsed: async (id: string, replacedById: string) => {
        Object.assign(this.rows.get(id)!, { usedAt: new Date(), replacedById });
      },
      revoke: async (id: string) => {
        this.rows.get(id)!.revokedAt = new Date();
      },
      revokeFamily: async (familyId: string) => {
        for (const row of this.rows.values()) {
          if (row.familyId === familyId && !row.revokedAt) row.revokedAt = new Date();
        }
      },
    } as unknown as RefreshSessionsRepository;
  }

  transactions(): TransactionManager {
    return {
      run: async <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => {
        const snapshot = new Map([...this.rows].map(([id, row]) => [id, { ...row }]));
        try {
          return await work({} as EntityManager);
        } catch (error) {
          this.rows = snapshot;
          throw error;
        }
      },
    } as unknown as TransactionManager;
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'admin@aura.local',
    displayName: 'Admin',
    status: UserStatus.ACTIVE,
    userRoles: [{
      role: { code: 'admin', rolePermissions: [{ permission: { code: 'user:read' } }] },
    }],
    ...overrides,
  } as unknown as User;
}

describe('TokenService', () => {
  const jwt = new JwtService();
  let store: InMemorySessions;
  let user: User | null;
  let service: TokenService;

  beforeEach(() => {
    store = new InMemorySessions();
    user = makeUser();
    const users = { findByIdWithAccess: async () => user } as unknown as UsersRepository;
    const config = { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService;
    service = new TokenService(jwt, config, store.repository(), users, store.transactions());
  });

  it('signAccess ký JWT mang roles + permissions với secret/TTL từ config', async () => {
    const token = await service.signAccess({
      id: 'u1', email: 'e@x', displayName: 'E', roles: ['editor'], permissions: ['room:read'],
    }, 'fam-9');
    const payload = await jwt.verifyAsync<JwtAccessPayload & { exp: number; iat: number }>(token, { secret: SECRET });
    assert.equal(payload.sub, 'u1');
    assert.deepEqual(payload.roles, ['editor']);
    assert.deepEqual(payload.permissions, ['room:read']);
    assert.equal(payload.sid, 'fam-9');
    assert.equal(payload.exp - payload.iat, 15 * 60);
  });

  it('issueRefresh chỉ lưu SHA-256 của token, không lưu raw; hạn = refreshTtlDays', async () => {
    const before = Date.now();
    const { raw, session } = await service.issueRefresh('user-1');
    assert.match(raw, /^[0-9a-f]{64}$/);
    assert.equal(session.tokenHash, sha256(raw));
    assert.notEqual(session.tokenHash, raw);
    assert.ok(session.familyId);
    const ttl = session.expiresAt.getTime() - before;
    assert.ok(ttl >= 7 * DAY_MS - 1000 && ttl <= 7 * DAY_MS + 1000);
    assert.equal(service.refreshCookieMaxAgeMs(), 7 * DAY_MS);
  });

  it('issueRefresh lưu User-Agent/IP (cắt độ dài) và signedInAt', async () => {
    const signedInAt = new Date('2026-10-01T00:00:00Z');
    const { session } = await service.issueRefresh('user-1', undefined, undefined, { userAgent: 'x'.repeat(600), ip: '1.2.3.4' }, signedInAt);
    assert.equal(session.userAgent?.length, 512);
    assert.equal(session.ip, '1.2.3.4');
    assert.equal(session.signedInAt, signedInAt);
  });

  it('rotate: giữ signedInAt của lần đăng nhập, cập nhật UA/IP theo request; access token mang sid = familyId', async () => {
    const signedInAt = new Date('2026-10-01T00:00:00Z');
    const issued = await service.issueRefresh('user-1', undefined, undefined, { userAgent: 'old', ip: '1.1.1.1' }, signedInAt);
    const rotated = await service.rotate(issued.raw, { userAgent: 'new', ip: '2.2.2.2' });
    assert.equal(rotated.session.signedInAt, signedInAt);
    assert.equal(rotated.session.userAgent, 'new');
    assert.equal(rotated.session.ip, '2.2.2.2');
    const payload = await jwt.verifyAsync<JwtAccessPayload>(rotated.accessToken, { secret: SECRET });
    assert.equal(payload.sid, issued.session.familyId);
    const keep = await service.rotate(rotated.raw);
    assert.equal(keep.session.userAgent, 'new', 'request không gửi UA thì giữ UA cũ');
  });

  it('issueRefresh giữ familyId khi được truyền, mỗi lần sinh token khác nhau', async () => {
    const first = await service.issueRefresh('user-1', 'fam-1');
    const second = await service.issueRefresh('user-1', 'fam-1');
    assert.equal(first.session.familyId, 'fam-1');
    assert.notEqual(first.raw, second.raw);
  });

  it('rotate: token hợp lệ → token mới cùng family, token cũ được đánh dấu used', async () => {
    const issued = await service.issueRefresh('user-1');
    const rotated = await service.rotate(issued.raw);

    assert.equal(rotated.userId, 'user-1');
    assert.notEqual(rotated.raw, issued.raw);
    assert.equal(rotated.session.familyId, issued.session.familyId);
    const old = store.rows.get(issued.session.id)!;
    assert.ok(old.usedAt);
    assert.equal(old.replacedById, rotated.session.id);
    assert.deepEqual(store.locks, [issued.session.familyId]);
    const payload = await jwt.verifyAsync<JwtAccessPayload>(rotated.accessToken, { secret: SECRET });
    assert.deepEqual(payload.permissions, ['user:read']);
  });

  it('rotate: token không tồn tại → 401, không khóa family nào', async () => {
    await assert.rejects(service.rotate('unknown'), UnauthorizedException);
    assert.deepEqual(store.locks, []);
  });

  it('rotate: dùng lại token cũ (reuse) → 401 và thu hồi CẢ family, kể cả token mới', async () => {
    const issued = await service.issueRefresh('user-1');
    const rotated = await service.rotate(issued.raw);

    await assert.rejects(service.rotate(issued.raw), UnauthorizedException);
    for (const row of store.rows.values()) {
      assert.ok(row.revokedAt, `session ${row.id} phải bị thu hồi sau khi phát hiện reuse`);
    }
    // Token mới hợp lệ trước đó cũng không dùng được nữa.
    await assert.rejects(service.rotate(rotated.raw), UnauthorizedException);
  });

  it('rotate: token đã bị thu hồi → 401', async () => {
    const issued = await service.issueRefresh('user-1');
    await service.revokeByRaw(issued.raw);
    await assert.rejects(service.rotate(issued.raw), UnauthorizedException);
  });

  it('rotate: token hết hạn → 401 và chỉ thu hồi session đó (revoke được commit)', async () => {
    const live = await service.issueRefresh('user-1', 'fam-x');
    const expired = await service.issueRefresh('user-1', 'fam-x');
    store.rows.get(expired.session.id)!.expiresAt = new Date(Date.now() - 1);

    await assert.rejects(service.rotate(expired.raw), UnauthorizedException);
    assert.ok(store.rows.get(expired.session.id)!.revokedAt);
    assert.equal(store.rows.get(live.session.id)!.revokedAt, null);
  });

  it('rotate: user bị khóa hoặc đã xóa → 401 và thu hồi cả family', async () => {
    for (const next of [makeUser({ status: UserStatus.DISABLED }), null]) {
      user = next;
      const issued = await service.issueRefresh('user-1');
      await assert.rejects(service.rotate(issued.raw), UnauthorizedException);
      assert.ok(store.rows.get(issued.session.id)!.revokedAt);
    }
  });

  it('rotate: token biến mất sau khi khóa family (race) → 401', async () => {
    const issued = await service.issueRefresh('user-1');
    const repository = store.repository();
    let calls = 0;
    const racing = {
      ...repository,
      findByTokenHash: async (hash: string) => (++calls === 1 ? repository.findByTokenHash(hash) : null),
    } as unknown as RefreshSessionsRepository;
    const users = { findByIdWithAccess: async () => user } as unknown as UsersRepository;
    const config = { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService;
    const raced = new TokenService(jwt, config, racing, users, store.transactions());
    await assert.rejects(raced.rotate(issued.raw), UnauthorizedException);
  });

  it('rotate: lỗi giữa chừng → rollback toàn bộ, token cũ vẫn dùng được', async () => {
    const issued = await service.issueRefresh('user-1');
    const repository = store.repository();
    const failing = {
      ...repository,
      markUsed: async () => {
        throw new Error('db down');
      },
    } as unknown as RefreshSessionsRepository;
    const users = { findByIdWithAccess: async () => user } as unknown as UsersRepository;
    const config = { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService;
    const broken = new TokenService(jwt, config, failing, users, store.transactions());

    const sizeBefore = store.rows.size;
    await assert.rejects(broken.rotate(issued.raw), /db down/);
    assert.equal(store.rows.size, sizeBefore, 'session mới phải bị rollback');
    assert.equal(store.rows.get(issued.session.id)!.usedAt, null);
    await service.rotate(issued.raw);
  });

  it('revokeByRaw thu hồi cả family; token lạ thì bỏ qua', async () => {
    const issued = await service.issueRefresh('user-1');
    const rotated = await service.rotate(issued.raw);
    await service.revokeByRaw(issued.raw);
    assert.ok(store.rows.get(rotated.session.id)!.revokedAt);
    await service.revokeByRaw('unknown');
  });
});
