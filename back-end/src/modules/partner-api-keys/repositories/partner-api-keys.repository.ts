import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { PartnerApiKey } from '../entities/partner-api-key.entity';

@Injectable()
export class PartnerApiKeysRepository extends BaseRepository<PartnerApiKey> {
  constructor(@InjectRepository(PartnerApiKey) repo: Repository<PartnerApiKey>) {
    super(repo);
  }

  /** Danh sách key chưa xóa mềm. */
  listAll(): Promise<PartnerApiKey[]> {
    return this.repo.find({ where: { isDeleted: false }, order: { createdAt: 'DESC' } });
  }

  override findById(id: string): Promise<PartnerApiKey | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  /** Key dùng được để gọi cổng đối tác: đang active, chưa xóa, chưa hết hạn. */
  findUsableByHash(keyHash: string, now: Date): Promise<PartnerApiKey | null> {
    const usable = { keyHash, status: 'active' as const, isDeleted: false };
    return this.repo.findOne({ where: [{ ...usable, expiresAt: IsNull() }, { ...usable, expiresAt: MoreThan(now) }] });
  }

  async touchLastUsed(id: string, at: Date): Promise<void> {
    await this.repo.update(id, { lastUsedAt: at });
  }

  existsByHash(keyHash: string): Promise<boolean> {
    return this.exists({ keyHash });
  }
}
