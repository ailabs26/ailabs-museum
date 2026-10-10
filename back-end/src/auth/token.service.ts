import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../common/types/auth-user.type';
import { JwtAccessPayload } from '../core/auth/jwt.payload';
import { RefreshSession } from '../refresh-sessions/refresh-session.entity';
import { RefreshSessionsRepository } from './repositories/refresh-sessions.repository';

export interface IssuedRefresh {
  raw: string;
  session: RefreshSession;
}

export interface RotatedRefresh {
  userId: string;
  raw: string;
  session: RefreshSession;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: RefreshSessionsRepository,
  ) {}

  /** Ký access token mang roles + permissions. */
  signAccess(user: AuthUser): Promise<string> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      permissions: user.permissions,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_TTL'),
    });
  }

  /** Phát hành refresh token mới (lưu hash); familyId mới nếu không truyền. */
  async issueRefresh(userId: string, familyId?: string): Promise<IssuedRefresh> {
    const raw = randomBytes(32).toString('hex');
    const session = await this.sessions.create({
      userId,
      familyId: familyId ?? randomUUID(),
      tokenHash: this.hash(raw),
      expiresAt: this.refreshExpiry(),
    });
    return { raw, session };
  }

  /**
   * Xoay vòng refresh token. Token cũ đã dùng/bị thu hồi → thu hồi cả family
   * và từ chối (reuse-detection). Token hợp lệ → phát hành token mới cùng family.
   */
  async rotate(raw: string): Promise<RotatedRefresh> {
    const current = await this.sessions.findByTokenHash(this.hash(raw));
    if (!current) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    if (current.usedAt || current.revokedAt) {
      // Token đã dùng rồi lại bị dùng tiếp → nghi ngờ bị đánh cắp.
      await this.sessions.revokeFamily(current.familyId);
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
    }

    if (current.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const next = await this.issueRefresh(current.userId, current.familyId);
    await this.sessions.markUsed(current.id, next.session.id);
    return { userId: current.userId, raw: next.raw, session: next.session };
  }

  revokeSession(id: string): Promise<void> {
    return this.sessions.revoke(id);
  }

  /** Thu hồi session theo raw token (dùng khi logout). */
  async revokeByRaw(raw: string): Promise<void> {
    const session = await this.sessions.findByTokenHash(this.hash(raw));
    if (session && !session.revokedAt) {
      await this.sessions.revoke(session.id);
    }
  }

  refreshCookieMaxAgeMs(): number {
    return this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshCookieMaxAgeMs());
  }
}
