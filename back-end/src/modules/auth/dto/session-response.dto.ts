import { ApiProperty } from '@nestjs/swagger';
import type { RefreshSession } from '../entities/refresh-session.entity';

/** Một thiết bị đang đăng nhập — không lộ token hash hay id của từng lần xoay vòng. */
export class SessionResponse {
  @ApiProperty({ format: 'uuid', description: 'familyId của phiên (dùng cho DELETE /auth/sessions/:id)' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  userAgent!: string | null;

  @ApiProperty({ nullable: true, type: String })
  ip!: string | null;

  @ApiProperty()
  signedInAt!: Date;

  @ApiProperty({ description: 'Lần xoay vòng refresh gần nhất' })
  lastActiveAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ description: 'Là phiên đang gọi API' })
  current!: boolean;
}

export function toSessionResponse(session: RefreshSession, currentSessionId?: string): SessionResponse {
  return {
    id: session.familyId,
    userAgent: session.userAgent,
    ip: session.ip,
    signedInAt: session.signedInAt,
    lastActiveAt: session.createdAt,
    expiresAt: session.expiresAt,
    current: session.familyId === currentSessionId,
  };
}
