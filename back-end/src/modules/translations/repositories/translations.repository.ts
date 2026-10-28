import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Translation } from '../entities/translation.entity';

@Injectable()
export class TranslationsRepository extends BaseRepository<Translation> {
  constructor(@InjectRepository(Translation) repo: Repository<Translation>) {
    super(repo);
  }

  listAll(): Promise<Translation[]> {
    return this.repo.find({ order: { namespace: 'ASC' } });
  }

  findByNamespace(namespace: string): Promise<Translation | null> {
    return this.repo.findOne({ where: { namespace } });
  }
}
