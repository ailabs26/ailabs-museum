import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuthUser } from '../../../common/types/auth-user.type';
import { JwtAccessPayload } from '../../../common/types/jwt.payload';
import { RefreshSession } from '../entities/refresh-session.entity';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserStatus } from '../../users/entities/user.entity';
import { toAuthUser } from '../../users/user-access.util';

/** Thông tin thiết bị lưu kèm refresh session (màn "Phiên đăng nhập"). */
export interface SessionClient {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedRefresh {
  raw: string;
  session: RefreshSession;
}

export interface RotatedRefresh {
  userId: string;
  raw: string;
  session: RefreshSession;
  accessToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: RefreshSessionsRepository,
    private readonly users: UsersRepository,
    private readonly tx: TransactionManager,
  ) {}

  /** Ký access token mang roles + permissions và `sid` = familyId của phiên. */
  signAccess(user: AuthUser, sessionId: string): Promise<string> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      permissions: user.permissions,
      sid: sessionId,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.getOrThrow<string>('jwt.accessTtl'),
    });
  }

  /** Phát hành refresh token mới (lưu hash); familyId mới nếu không truyền. */
  async issueRefresh(
    userId: string,
    familyId?: string,
    manager?: EntityManager,
    client: SessionClient = {},
    signedInAt = new Date(),
  ): Promise<IssuedRefresh> {
    const raw = randomBytes(32).toString('hex');
    const session = await this.sessions.create(
      {
        userId,
        familyId: familyId ?? randomUUID(),
        tokenHash: this.hash(raw),
        expiresAt: this.refreshExpiry(),
        signedInAt,
        userAgent: client.userAgent?.slice(0, 512) ?? null,
        ip: client.ip?.slice(0, 64) ?? null,
      },
      manager,
    );
    return { raw, session };
  }

  /**
   * Xoay vòng refresh token. Token cũ đã dùng/bị thu hồi → thu hồi cả family
   * và từ chối (reuse-detection). Token hợp lệ → phát hành token mới cùng family.
   */
  async rotate(raw: string, client: SessionClient = {}): Promise<RotatedRefresh> {
    const tokenHash = this.hash(raw);
    const result = await this.tx.run(async (manager): Promise<RotatedRefresh | null> => {
      const found = await this.sessions.findByTokenHash(tokenHash, manager);
      if (!found) {
        return null;
      }

      await this.sessions.lockFamily(found.familyId, manager);
      await this.sessions.lockUser(found.userId, manager);
      const current = await this.sessions.findByTokenHash(tokenHash, manager, true);
      if (!current) {
        return null;
      }

      if (current.usedAt || current.revokedAt) {
        await this.sessions.revokeFamily(current.familyId, manager);
        return null;
      }

      if (current.expiresAt.getTime() <= Date.now()) {
        await this.sessions.revoke(current.id, manager);
        return null;
      }

      const user = await this.users.findByIdWithAccess(current.userId, manager);
      if (!user || user.status !== UserStatus.ACTIVE) {
        await this.sessions.revokeFamily(current.familyId, manager);
        return null;
      }

      const accessToken = await this.signAccess(toAuthUser(user), current.familyId);
      const next = await this.issueRefresh(
        current.userId,
        current.familyId,
        manager,
        { userAgent: client.userAgent ?? current.userAgent, ip: client.ip ?? current.ip },
        current.signedInAt,
      );
      await this.sessions.markUsed(current.id, next.session.id, manager);
      return { userId: current.userId, raw: next.raw, session: next.session, accessToken };
    });

    // Ném lỗi sau commit để việc revoke do expiry/reuse không bị rollback.
    if (!result) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return result;
  }

  /** Thu hồi session theo raw token (dùng khi logout). */
  /** Trả userId của phiên vừa thu hồi; null nếu token không tồn tại. */
  async revokeByRaw(raw: string): Promise<string | null> {
    return this.tx.run(async (manager) => {
      const session = await this.sessions.findByTokenHash(this.hash(raw), manager);
      if (!session) return null;
      await this.sessions.lockFamily(session.familyId, manager);
      // Cookie cũ vẫn phải thu hồi được token kế tiếp nếu logout đụng refresh.
      await this.sessions.revokeFamily(session.familyId, manager);
      return session.userId;
    });
  }

  refreshCookieMaxAgeMs(): number {
    return this.config.getOrThrow<number>('jwt.refreshTtlDays') * 24 * 60 * 60 * 1000;
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshCookieMaxAgeMs());
  }
}
