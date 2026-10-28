import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { PartnerApiKey } from '../entities/partner-api-key.entity';

@Injectable()
export class PartnerApiKeysRepository extends BaseRepository<PartnerApiKey> {
  constructor(@InjectRepository(PartnerApiKey) repo: Repository<PartnerApiKey>) {
    super(repo);
  }

  listAll(): Promise<PartnerApiKey[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  existsByHash(keyHash: string): Promise<boolean> {
    return this.exists({ keyHash });
  }
}
