import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { RefreshSession } from '../entities/refresh-session.entity';

@Injectable()
export class RefreshSessionsRepository {
  constructor(
    @InjectRepository(RefreshSession)
    private readonly repository: Repository<RefreshSession>,
  ) {}

  findByTokenHash(
    tokenHash: string,
    manager?: EntityManager,
    shouldLock = false,
  ): Promise<RefreshSession | null> {
    return this.getRepository(manager).findOne({
      where: { tokenHash },
      ...(shouldLock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }

  /** Cùng family phải tuần tự, kể cả replay token cũ trong lúc token mới refresh. */
  async lockFamily(familyId: string, manager: EntityManager): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [familyId]);
  }

  /**
   * Khóa theo user: refresh giữ khóa chia sẻ, thu hồi toàn bộ giữ khóa độc quyền.
   * Nhờ đó token vừa xoay vòng trong lúc Admin reset mật khẩu/khóa user vẫn bị thu hồi.
   */
  async lockUser(userId: string, manager: EntityManager, exclusive = false): Promise<void> {
    const fn = exclusive ? 'pg_advisory_xact_lock' : 'pg_advisory_xact_lock_shared';
    await manager.query(`SELECT ${fn}(hashtextextended($1, 0))`, [`user-sessions:${userId}`]);
  }

  create(
    session: Partial<RefreshSession>,
    manager?: EntityManager,
  ): Promise<RefreshSession> {
    const repository = this.getRepository(manager);
    return repository.save(repository.create(session));
  }

  /** Đánh dấu session đã được dùng để refresh và trỏ sang session kế tiếp. */
  async markUsed(id: string, replacedById: string, manager: EntityManager): Promise<void> {
    await this.getRepository(manager).update(id, { usedAt: new Date(), replacedById });
  }

  async revoke(id: string, manager: EntityManager): Promise<void> {
    await this.getRepository(manager).update(id, { revokedAt: new Date() });
  }

  /** Thu hồi toàn bộ session còn hiệu lực trong cùng family (reuse-detection). */
  async revokeFamily(familyId: string, manager: EntityManager): Promise<void> {
    await this.getRepository(manager).update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * Thu hồi mọi session còn hiệu lực của user (mọi thiết bị); `exceptFamilyId` giữ lại
   * phiên hiện tại ("đăng xuất các thiết bị khác").
   */
  async revokeAllForUser(userId: string, manager: EntityManager, exceptFamilyId?: string): Promise<void> {
    await this.lockUser(userId, manager, true);
    await this.getRepository(manager).update(
      { userId, revokedAt: IsNull(), ...(exceptFamilyId ? { familyId: Not(exceptFamilyId) } : {}) },
      { revokedAt: new Date() },
    );
  }

  /** Thu hồi một thiết bị của chính user; trả false nếu family không thuộc user hoặc đã chết. */
  async revokeFamilyOfUser(userId: string, familyId: string, manager: EntityManager): Promise<boolean> {
    await this.lockFamily(familyId, manager);
    const result = await this.getRepository(manager).update(
      { userId, familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  /** Family còn ít nhất một token chưa thu hồi và chưa hết hạn (ActiveSessionGuard gọi mỗi request). */
  isFamilyLive(familyId: string): Promise<boolean> {
    return this.repository.exists({
      where: { familyId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
  }

  /** Token đầu (đang dùng) của mỗi thiết bị còn đăng nhập, hoạt động gần nhất trước. */
  listLiveForUser(userId: string): Promise<RefreshSession[]> {
    return this.repository.find({
      where: { userId, usedAt: IsNull(), revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Xóa tối đa `limit` family đã chết hẳn: mọi row đều hết hạn hoặc bị thu hồi trước `cutoff`.
   * Family còn token "đã dùng" chưa hết hạn được giữ để reuse-detection vẫn bắt được replay.
   * FK `replaced_by_id` là RESTRICT nên gỡ liên kết trước rồi mới xóa. Trả số row đã xóa.
   * COALESCE bắt buộc: `revoked_at` NULL làm biểu thức thành NULL mà `bool_and` bỏ qua NULL.
   */
  async deleteDeadFamilies(cutoff: Date, limit: number, manager: EntityManager): Promise<number> {
    const families: { family_id: string }[] = await manager.query(
      `SELECT family_id FROM refresh_sessions
       GROUP BY family_id
       HAVING bool_and(COALESCE(expires_at < $1 OR revoked_at < $1, false))
       LIMIT $2`,
      [cutoff, limit],
    );
    if (families.length === 0) {
      return 0;
    }

    const ids = families.map((family) => family.family_id);
    await manager.query('UPDATE refresh_sessions SET replaced_by_id = NULL WHERE family_id = ANY($1)', [ids]);
    const [, affected]: [unknown, number] = await manager.query(
      'DELETE FROM refresh_sessions WHERE family_id = ANY($1)',
      [ids],
    );
    return affected;
  }

  private getRepository(manager?: EntityManager): Repository<RefreshSession> {
    return manager ? manager.getRepository(RefreshSession) : this.repository;
  }
}
