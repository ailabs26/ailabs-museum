import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '../../../common/types/paginated.type';
import {
  ExhibitRevision,
  RevisionState,
} from '../../exhibits/entities/exhibit-revision.entity';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { ListQueueQueryDto } from '../dto/list-queue-query.dto';

@Injectable()
export class ModerationRepository {
  constructor(
    @InjectRepository(ExhibitRevision)
    private readonly revisions: Repository<ExhibitRevision>,
    @InjectRepository(Exhibit)
    private readonly exhibits: Repository<Exhibit>,
  ) {}

  /** Lấy hiện vật (kể cả đang ẩn) theo id, bỏ bản đã xóa mềm. */
  findExhibit(id: string): Promise<Exhibit | null> {
    return this.exhibits.findOne({ where: { id, isDeleted: false } });
  }

  /** Hàng chờ kiểm duyệt: revision in_review, cũ nhất lên trước (FIFO). */
  async queue(query: ListQueueQueryDto): Promise<Paginated<ExhibitRevision>> {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));

    const qb = this.revisions
      .createQueryBuilder('rev')
      .innerJoinAndSelect('rev.exhibit', 'exhibit')
      .leftJoinAndSelect('rev.createdBy', 'createdBy')
      .where('rev.state = :state', { state: RevisionState.IN_REVIEW });

    if (query.roomId) {
      qb.andWhere('exhibit.room_id = :roomId', { roomId: query.roomId });
    }

    qb.orderBy('rev.createdAt', 'ASC')
      .addOrderBy('rev.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** Chi tiết 1 revision kèm hiện vật + người tạo/duyệt + hotspot. */
  findDetail(id: string): Promise<ExhibitRevision | null> {
    return this.revisions.findOne({
      where: { id },
      relations: {
        exhibit: true,
        createdBy: true,
        reviewedBy: true,
        hotspots: true,
      },
    });
  }

  /** Lịch sử revision của 1 hiện vật, mới nhất lên trước. */
  findHistory(exhibitId: string): Promise<ExhibitRevision[]> {
    return this.revisions.find({
      where: { exhibitId },
      relations: { createdBy: true, reviewedBy: true },
      order: { revisionNo: 'DESC' },
    });
  }

  /** Revision kèm hiện vật (và revision đang xuất bản của hiện vật) phục vụ diff. */
  findForDiff(id: string): Promise<ExhibitRevision | null> {
    return this.revisions.findOne({
      where: { id },
      relations: { exhibit: { publishedRevision: true } },
    });
  }
}
