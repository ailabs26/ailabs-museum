import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
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

  /** Thu hồi mọi session còn hiệu lực của user (mọi thiết bị). */
  async revokeAllForUser(userId: string, manager: EntityManager): Promise<void> {
    await this.lockUser(userId, manager, true);
    await this.getRepository(manager).update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private getRepository(manager?: EntityManager): Repository<RefreshSession> {
    return manager ? manager.getRepository(RefreshSession) : this.repository;
  }
}
