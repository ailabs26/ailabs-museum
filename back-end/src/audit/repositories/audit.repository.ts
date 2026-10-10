import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '../../common/types/paginated.type';
import { AuditLog } from '../audit-log.entity';
import { BaseRepository } from '../../core/repository/base.repository';

export interface ListAuditOptions {
  page: number;
  pageSize: number;
  actorId?: string;
  action?: string;
  resourceType?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditRepository extends BaseRepository<AuditLog> {
  constructor(@InjectRepository(AuditLog) repo: Repository<AuditLog>) {
    super(repo);
  }

  async listPaginated(options: ListAuditOptions): Promise<Paginated<AuditLog>> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);

    const query = this.repo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor');

    if (options.actorId) query.andWhere('audit.actorId = :actorId', { actorId: options.actorId });
    if (options.action) query.andWhere('audit.action = :action', { action: options.action });
    if (options.resourceType) {
      query.andWhere('audit.resourceType = :resourceType', { resourceType: options.resourceType });
    }
    if (options.from) query.andWhere('audit.occurredAt >= :from', { from: options.from });
    if (options.to) query.andWhere('audit.occurredAt <= :to', { to: options.to });

    const [items, total] = await query
      .orderBy('audit.occurredAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }
}
