import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository, WhereExpressionBuilder } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Paginated } from '../../../common/types/paginated.type';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../exhibits/entities/exhibit-revision.entity';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { Media } from '../entities/media.entity';

/** Số nơi đang tham chiếu một media — dùng cho quy tắc xóa BR-21. */
export interface MediaUsage {
  /** Exhibit (chưa xóa) có revision đang published dùng media này. */
  publishedExhibits: number;
  /** Revision đang chờ duyệt (in_review) dùng media này. */
  pendingRevisions: number;
}

/** Điều kiện revision tham chiếu media ở bất kỳ slot nào (model/image/audio). */
function referencesMedia(qb: WhereExpressionBuilder): void {
  qb.where('revision.modelMediaId = :mediaId')
    .orWhere('revision.imageMediaId = :mediaId')
    .orWhere('revision.audioMediaId = :mediaId');
}

@Injectable()
export class MediaRepository extends BaseRepository<Media> {
  constructor(@InjectRepository(Media) repo: Repository<Media>) {
    super(repo);
  }

  /** Tìm media chưa bị xóa mềm. */
  findActiveById(id: string): Promise<Media | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  /**
   * Danh sách media cho thư viện Admin: lọc kind/trạng thái, tìm ILIKE theo tên file và
   * metadata quyền sử dụng; mới nhất trước.
   */
  async listPaginated(query: ListMediaQueryDto): Promise<Paginated<Media>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const qb = this.repo
      .createQueryBuilder('media')
      .where('media.isDeleted = :isDeleted', { isDeleted: false });

    if (query.kind) qb.andWhere('media.kind = :kind', { kind: query.kind });
    if (query.state) qb.andWhere('media.processingState = :state', { state: query.state });

    const keyword = query.q?.trim();
    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('media.originalName ILIKE :search')
            .orWhere('media.altText ILIKE :search')
            .orWhere('media.source ILIKE :search')
            .orWhere('media.author ILIKE :search')
            .orWhere('media.license ILIKE :search');
        }),
        // Escape ký tự đại diện để tìm đúng chuỗi người dùng nhập.
        { search: `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('media.createdAt', 'DESC')
      .addOrderBy('media.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** Khóa dòng media (SELECT … FOR UPDATE) trong transaction để kiểm tra & xóa nguyên tử. */
  lockActiveById(id: string, manager: EntityManager): Promise<Media | null> {
    return manager
      .getRepository(Media)
      .createQueryBuilder('media')
      .setLock('pessimistic_write')
      .where('media.id = :id', { id })
      .andWhere('media.isDeleted = :isDeleted', { isDeleted: false })
      .getOne();
  }

  /** Đếm tham chiếu từ revision đang published và revision đang chờ duyệt. */
  async countUsage(mediaId: string, manager?: EntityManager): Promise<MediaUsage> {
    const em = manager ?? this.repo.manager;

    const publishedExhibits = await em
      .createQueryBuilder(Exhibit, 'exhibit')
      .innerJoin(ExhibitRevision, 'revision', 'revision.id = exhibit.publishedRevisionId')
      .where('exhibit.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(new Brackets(referencesMedia))
      .setParameter('mediaId', mediaId)
      .getCount();

    const pendingRevisions = await em
      .createQueryBuilder(ExhibitRevision, 'revision')
      .innerJoin('revision.exhibit', 'exhibit')
      .where('revision.state = :state', { state: RevisionState.IN_REVIEW })
      .andWhere('exhibit.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(new Brackets(referencesMedia))
      .setParameter('mediaId', mediaId)
      .getCount();

    return { publishedExhibits, pendingRevisions };
  }
}
