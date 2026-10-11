import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RefreshSession } from '../entities/refresh-session.entity';

@Injectable()
export class RefreshSessionsRepository {
  constructor(
    @InjectRepository(RefreshSession)
    private readonly repository: Repository<RefreshSession>,
  ) {}

  findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    return this.repository.findOne({ where: { tokenHash } });
  }

  create(session: Partial<RefreshSession>): Promise<RefreshSession> {
    return this.repository.save(this.repository.create(session));
  }

  /** Đánh dấu session đã được dùng để refresh và trỏ sang session kế tiếp. */
  async markUsed(id: string, replacedById: string): Promise<void> {
    await this.repository.update(id, { usedAt: new Date(), replacedById });
  }

  async revoke(id: string): Promise<void> {
    await this.repository.update(id, { revokedAt: new Date() });
  }

  /** Thu hồi toàn bộ session còn hiệu lực trong cùng family (reuse-detection). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.repository.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
