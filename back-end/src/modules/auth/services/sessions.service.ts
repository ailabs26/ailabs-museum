import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { toSessionResponse, type SessionResponse } from '../dto/session-response.dto';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';

/** Người dùng tự xem và đăng xuất các thiết bị của chính mình. */
@Injectable()
export class SessionsService {
  constructor(
    private readonly sessions: RefreshSessionsRepository,
    private readonly tx: TransactionManager,
  ) {}

  async list(user: AuthUser): Promise<SessionResponse[]> {
    const rows = await this.sessions.listLiveForUser(user.id);
    return rows.map((row) => toSessionResponse(row, user.sessionId));
  }

  /** Trả true nếu phiên vừa thu hồi là phiên hiện tại (controller xóa cookie). */
  async revoke(user: AuthUser, sessionId: string): Promise<boolean> {
    const revoked = await this.tx.run((manager) =>
      this.sessions.revokeFamilyOfUser(user.id, sessionId, manager),
    );
    // 404 cả khi phiên thuộc người khác — không lộ sự tồn tại của nó.
    if (!revoked) throw new NotFoundException('Không tìm thấy phiên đăng nhập');
    return sessionId === user.sessionId;
  }

  revokeOthers(user: AuthUser): Promise<void> {
    return this.tx.run((manager) => this.sessions.revokeAllForUser(user.id, manager, user.sessionId));
  }

  revokeAll(user: AuthUser): Promise<void> {
    return this.tx.run((manager) => this.sessions.revokeAllForUser(user.id, manager));
  }
}
