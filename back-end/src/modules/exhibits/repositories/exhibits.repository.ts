import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, IsNull, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Paginated } from '../../../common/types/paginated.type';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { REVISION_MEDIA_RELATIONS } from '../constants/revision-media-slots';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';

@Injectable()
export class ExhibitsRepository extends BaseRepository<Exhibit> {
  constructor(
    @InjectRepository(Exhibit)
    repo: Repository<Exhibit>,
    @InjectRepository(ExhibitRevision)
    private readonly revisionRepo: Repository<ExhibitRevision>,
    @InjectRepository(Hotspot)
    private readonly hotspotRepo: Repository<Hotspot>,
  ) {
    super(repo);
  }

  /** Lấy Repository của ExhibitRevision gắn với EntityManager (nếu đang trong transaction). */
  protected scopedRevision(manager?: EntityManager): Repository<ExhibitRevision> {
    return manager ? manager.getRepository(this.revisionRepo.target) : this.revisionRepo;
  }

  /** Lấy Repository của Hotspot gắn với EntityManager (nếu đang trong transaction). */
  protected scopedHotspot(manager?: EntityManager): Repository<Hotspot> {
    return manager ? manager.getRepository(this.hotspotRepo.target) : this.hotspotRepo;
  }

  /**
   * Truy vấn danh sách hiện vật công khai theo phòng trưng bày (FR-68).
   * Chỉ lấy hiện vật visible, chưa xóa mềm, chưa lưu trữ, có revision published đã APPROVED;
   * nạp đủ các slot media của revision đó. Điều kiện phải khớp với
   * `MediaRepository.isPubliclyReferenced` (phân phối file media).
   */
  async findByRoom(roomId: string): Promise<Exhibit[]> {
    return this.repo.find({
      where: {
        roomId,
        visibility: ExhibitVisibility.VISIBLE,
        isDeleted: false,
        archivedAt: IsNull(),
        publishedRevisionId: Not(IsNull()),
        publishedRevision: { state: RevisionState.APPROVED },
      },
      relations: {
        publishedRevision: {
          ...REVISION_MEDIA_RELATIONS,
          hotspots: true,
        },
      },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Lấy chi tiết một hiện vật cho Admin CMS theo ID.
   * Nạp đầy đủ thông tin phòng, bản xuất bản hiện tại và toàn bộ danh sách phiên bản.
   */
  async findAdminDetailById(id: string): Promise<Exhibit | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: {
        room: true,
        publishedRevision: {
          ...REVISION_MEDIA_RELATIONS,
          hotspots: true,
        },
        revisions: {
          ...REVISION_MEDIA_RELATIONS,
          hotspots: true,
          createdBy: true,
          reviewedBy: true,
        },
      },
    });
  }

  /**
   * Lấy toàn bộ lịch sử các phiên bản (revisions) của một hiện vật.
   * Sắp xếp theo revision_no giảm dần (phiên bản mới nhất lên đầu).
   */
  async findRevisionsByExhibitId(exhibitId: string): Promise<ExhibitRevision[]> {
    return this.revisionRepo.find({
      where: { exhibitId },
      relations: {
        ...REVISION_MEDIA_RELATIONS,
        hotspots: true,
        createdBy: true,
        reviewedBy: true,
      },
      order: { revisionNo: 'DESC' },
    });
  }

  /**
   * Lấy chi tiết một bản revision theo ID.
   */
  async findRevisionById(
    revisionId: string,
    manager?: EntityManager,
  ): Promise<ExhibitRevision | null> {
    return this.scopedRevision(manager).findOne({
      where: { id: revisionId },
      relations: {
        exhibit: true,
        ...REVISION_MEDIA_RELATIONS,
        hotspots: true,
        createdBy: true,
        reviewedBy: true,
      },
    });
  }

  /**
   * Tìm số thứ tự phiên bản lớn nhất hiện tại của hiện vật (để tạo revision_no tiếp theo).
   */
  async findLatestRevisionNo(exhibitId: string, manager?: EntityManager): Promise<number> {
    const qb = this.scopedRevision(manager)
      .createQueryBuilder('rev')
      .select('MAX(rev.revisionNo)', 'maxNo')
      .where('rev.exhibitId = :exhibitId', { exhibitId });

    const raw = await qb.getRawOne<{ maxNo: string | number | null }>();
    if (!raw || raw.maxNo === null || raw.maxNo === undefined) {
      return 0;
    }
    return Number(raw.maxNo);
  }

  /**
   * Lấy revision mới nhất (theo revision_no giảm dần) của một hiện vật.
   */
  async findActiveRevision(
    exhibitId: string,
    manager?: EntityManager,
  ): Promise<ExhibitRevision | null> {
    return this.scopedRevision(manager).findOne({
      where: { exhibitId },
      relations: {
        ...REVISION_MEDIA_RELATIONS,
        hotspots: true,
      },
      order: { revisionNo: 'DESC' },
    });
  }

  /**
   * Tìm kiếm, lọc và phân trang hiện vật cho phân hệ Admin CMS.
   */
  async searchAdminExhibits(
    query: Partial<ListExhibitsQueryDto> = {},
  ): Promise<Paginated<Exhibit>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const qb: SelectQueryBuilder<Exhibit> = this.repo
      .createQueryBuilder('exhibit')
      .leftJoinAndSelect('exhibit.room', 'room')
      .leftJoinAndSelect('exhibit.publishedRevision', 'publishedRevision')
      .where('exhibit.isDeleted = :isDeleted', { isDeleted: false });

    if (query.roomId) {
      qb.andWhere('exhibit.roomId = :roomId', { roomId: query.roomId });
    }

    if (query.visibility) {
      qb.andWhere('exhibit.visibility = :visibility', { visibility: query.visibility });
    }

    if (query.status === 'published') {
      qb.andWhere('exhibit.publishedRevisionId IS NOT NULL')
        .andWhere('exhibit.visibility = :pubVis', { pubVis: ExhibitVisibility.VISIBLE });
    } else if (query.status === 'draft') {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('exhibit.publishedRevisionId IS NULL')
            .orWhere('exhibit.visibility = :draftVis', { draftVis: ExhibitVisibility.HIDDEN });
        }),
      );
    }

    if (query.q && query.q.trim()) {
      const search = `%${query.q.trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('room.name ILIKE :search')
            .orWhere('CAST(publishedRevision.content AS text) ILIKE :search');
        }),
        { search },
      );
    }

    qb.orderBy('exhibit.displayOrder', 'ASC')
      .addOrderBy('exhibit.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /**
   * Lưu hoặc cập nhật một bản ghi ExhibitRevision.
   */
  async saveRevision(
    revision: ExhibitRevision,
    manager?: EntityManager,
  ): Promise<ExhibitRevision> {
    return this.scopedRevision(manager).save(revision);
  }

  /**
   * Lưu mảng Hotspots.
   */
  async saveHotspots(hotspots: Hotspot[], manager?: EntityManager): Promise<Hotspot[]> {
    if (!hotspots.length) return [];
    return this.scopedHotspot(manager).save(hotspots);
  }

  /**
   * Xóa toàn bộ Hotspots theo danh sách revision IDs.
   */
  async deleteHotspotsByRevisionIds(
    revisionIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    if (!revisionIds.length) return;
    await this.scopedHotspot(manager).delete({ revisionId: In(revisionIds) });
  }

  /**
   * Xóa toàn bộ Revisions theo exhibitId.
   */
  async deleteRevisionsByExhibitId(
    exhibitId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scopedRevision(manager).delete({ exhibitId });
  }

  /**
   * Xóa một revision cụ thể theo ID.
   */
  async deleteRevisionById(
    revisionId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scopedRevision(manager).delete(revisionId);
  }

  /**
   * Cập nhật thứ tự hiển thị display_order của hiện vật.
   */
  async updateDisplayOrder(
    id: string,
    displayOrder: number,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).update(id, { displayOrder });
  }

  /**
   * Xóa liên hoàn một hiện vật Draft (BR-20):
   * Trong cùng 1 transaction: Xóa hotspots -> Xóa revisions -> Xóa exhibit.
   */
  async deleteCascadeDraft(exhibitId: string, manager?: EntityManager): Promise<void> {
    const revisions = await this.scopedRevision(manager).find({
      where: { exhibitId },
      select: ['id'],
    });

    const revisionIds = revisions.map((r) => r.id);
    if (revisionIds.length > 0) {
      await this.deleteHotspotsByRevisionIds(revisionIds, manager);
      await this.deleteRevisionsByExhibitId(exhibitId, manager);
    }

    await this.scoped(manager).delete(exhibitId);
  }

  /**
   * Đếm số lượng hiện vật trong một phòng.
   */
  async countByRoom(roomId: string, onlyPublished: boolean = false): Promise<number> {
    const where: Record<string, unknown> = { roomId, isDeleted: false };
    if (onlyPublished) {
      where.visibility = ExhibitVisibility.VISIBLE;
    }
    return this.repo.count({ where });
  }

  /**
   * Kiểm tra phòng có tồn tại bất kỳ hiện vật nào chưa bị xóa hay không.
   */
  async existsInRoom(roomId: string): Promise<boolean> {
    return this.exists({ roomId, isDeleted: false });
  }
}
