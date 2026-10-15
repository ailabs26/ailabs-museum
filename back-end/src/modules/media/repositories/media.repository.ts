import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository, WhereExpressionBuilder } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Paginated } from '../../../common/types/paginated.type';
import { REVISION_MEDIA_SLOTS } from '../../exhibits/constants/revision-media-slots';
import { Exhibit, ExhibitVisibility } from '../../exhibits/entities/exhibit.entity';
import { Room, RoomStatus } from '../../rooms/entities/room.entity';
import { ExhibitRevision, RevisionState } from '../../exhibits/entities/exhibit-revision.entity';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { Media, MediaProcessingState } from '../entities/media.entity';

/** Số nơi đang tham chiếu một media — dùng cho quy tắc xóa BR-21. */
export interface MediaUsage {
  /** Exhibit (chưa xóa) có revision đang published dùng media này. */
  publishedExhibits: number;
  /** Revision đang chờ duyệt (in_review) dùng media này. */
  pendingRevisions: number;
}

/** Điều kiện revision tham chiếu media ở bất kỳ slot nào (xem `REVISION_MEDIA_SLOTS`). */
function referencesMedia(qb: WhereExpressionBuilder): void {
  REVISION_MEDIA_SLOTS.forEach((slot, index) => {
    const condition = `revision.${slot.column} = :mediaId`;
    if (index === 0) qb.where(condition);
    else qb.orWhere(condition);
  });
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

  /**
   * Khóa chia sẻ (SELECT … FOR SHARE) các dòng media theo id, kể cả bản ghi đã xóa mềm
   * (để caller phân biệt lỗi). Id được loại trùng và sắp xếp để thứ tự khóa luôn cố định,
   * tránh deadlock giữa các transaction gắn cùng nhiều media.
   */
  lockByIds(ids: readonly string[], manager: EntityManager): Promise<Media[]> {
    const uniqueIds = [...new Set(ids)].sort();
    if (uniqueIds.length === 0) return Promise.resolve([]);
    return manager
      .getRepository(Media)
      .createQueryBuilder('media')
      .setLock('pessimistic_read')
      .where('media.id IN (:...ids)', { ids: uniqueIds })
      .orderBy('media.id', 'ASC')
      .getMany();
  }

  /** Media phân phối được theo storage key: chưa xóa mềm và đã xử lý xong (`ready`). */
  findDeliverableByKey(storageKey: string): Promise<Media | null> {
    return this.repo.findOne({
      where: { storageKey, isDeleted: false, processingState: MediaProcessingState.READY },
    });
  }

  /**
   * Media có đang được ít nhất một revision Published hiện hành của hiện vật còn công khai
   * tham chiếu không (FR-68, AC-36). Điều kiện "công khai" phải khớp với
   * `ExhibitsRepository.findByRoom` + kiểm tra phòng ở `ExhibitsService.roomWithExhibits`:
   * exhibit visible, chưa xóa, chưa lưu trữ; revision APPROVED; phòng active, chưa xóa.
   */
  isPubliclyReferenced(mediaId: string): Promise<boolean> {
    return this.repo.manager
      .createQueryBuilder(Exhibit, 'exhibit')
      .innerJoin(ExhibitRevision, 'revision', 'revision.id = exhibit.publishedRevisionId')
      .innerJoin(Room, 'room', 'room.id = exhibit.roomId')
      .where('exhibit.visibility = :visibility', { visibility: ExhibitVisibility.VISIBLE })
      .andWhere('exhibit.isDeleted = false')
      .andWhere('exhibit.archivedAt IS NULL')
      .andWhere('revision.state = :approved', { approved: RevisionState.APPROVED })
      .andWhere('room.status = :active', { active: RoomStatus.ACTIVE })
      .andWhere('room.isDeleted = false')
      .andWhere(new Brackets(referencesMedia))
      .setParameter('mediaId', mediaId)
      .getExists();
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
