import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '../../../common/types/paginated.type';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../exhibits/entities/exhibit-revision.entity';
import { ContentReport } from '../entities/content-report.entity';
import { ListReportsQueryDto } from '../dto/list-reports-query.dto';

@Injectable()
export class ContentReportsRepository {
  constructor(
    @InjectRepository(ContentReport)
    private readonly reports: Repository<ContentReport>,
    @InjectRepository(Exhibit)
    private readonly exhibits: Repository<Exhibit>,
    @InjectRepository(ExhibitRevision)
    private readonly revisions: Repository<ExhibitRevision>,
  ) {}

  /** Danh sách báo cáo, mới nhất lên trước, kèm phiên bản bị báo cáo + người tiếp nhận. */
  async list(query: ListReportsQueryDto): Promise<Paginated<ContentReport>> {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));

    const [items, total] = await this.reports.findAndCount({
      where: query.status ? { status: query.status } : {},
      relations: { reportedRevision: true, assignedTo: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  /** Chi tiết báo cáo kèm phiên bản bị báo cáo + người tiếp nhận. */
  findDetail(id: string): Promise<ContentReport | null> {
    return this.reports.findOne({
      where: { id },
      relations: { reportedRevision: true, assignedTo: true },
    });
  }

  /** Kiểm tra hiện vật tồn tại (cho báo cáo từ client). */
  async exhibitExists(id: string): Promise<boolean> {
    return (await this.exhibits.count({ where: { id, isDeleted: false } })) > 0;
  }

  async revisionBelongsToExhibit(revisionId: string, exhibitId: string): Promise<boolean> {
    return (await this.revisions.count({ where: { id: revisionId, exhibitId, state: RevisionState.APPROVED } })) > 0;
  }

  create(data: Partial<ContentReport>): ContentReport {
    return this.reports.create(data);
  }

  save(report: ContentReport): Promise<ContentReport> {
    return this.reports.save(report);
  }
}
