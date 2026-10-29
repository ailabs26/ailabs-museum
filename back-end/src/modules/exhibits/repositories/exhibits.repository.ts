import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, IsNull, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Paginated } from '../../../common/types/paginated.type';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import { PublicSearchQueryDto } from '../dto/public-search-query.dto';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { REVISION_MEDIA_RELATIONS } from '../constants/revision-media-slots';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ContentReport } from '../../content-reports/entities/content-report.entity';

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

  /** Lock the scalar exhibit row, without nullable joins, before lifecycle mutations. */
  findForUpdate(id: string, manager: EntityManager): Promise<Exhibit | null> {
    return this.scoped(manager).findOne({ where: { id, isDeleted: false }, lock: { mode: 'pessimistic_write' } });
  }

  findRevisionsForDeletion(exhibitId: string, manager: EntityManager): Promise<ExhibitRevision[]> {
    return this.scopedRevision(manager).find({
      where: { exhibitId }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' },
    });
  }

  async hasReportReferences(exhibitId: string, revisionIds: string[], manager: EntityManager): Promise<boolean> {
    return manager.getRepository(ContentReport).exists({ where: [
      { exhibitId }, ...(revisionIds.length ? [{ reportedRevisionId: In(revisionIds) }] : []),
    ] });
  }

  /** Only report FKs blocking this deletion are translated; other DB failures propagate. */
  isReportReferenceConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('driverError' in error)) return false;
    const driver = error.driverError as { code?: string; constraint?: string } | undefined;
    if (driver?.code !== '23503') return false;
    const metadata = this.repo.manager.connection.getMetadata(ContentReport);
    return metadata.foreignKeys.some(fk => fk.name === driver.constraint &&
      (fk.referencedEntityMetadata.target === Exhibit || fk.referencedEntityMetadata.target === ExhibitRevision));
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
   * Lấy revision mới nhất của nhiều hiện vật trong một truy vấn (DISTINCT ON), trả về Map theo exhibitId.
   */
  async findLatestRevisionsByExhibitIds(
    exhibitIds: string[],
  ): Promise<Map<string, ExhibitRevision>> {
    if (exhibitIds.length === 0) {
      return new Map();
    }
    const revisions = await this.revisionRepo
      .createQueryBuilder('rev')
      .distinctOn(['rev.exhibitId'])
      .where('rev.exhibitId IN (:...exhibitIds)', { exhibitIds })
      .orderBy('rev.exhibitId')
      .addOrderBy('rev.revisionNo', 'DESC')
      .getMany();
    return new Map(revisions.map((rev) => [rev.exhibitId, rev]));
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
      .where('exhibit.isDeleted = :isDeleted', { isDeleted: query.deleted ?? false });

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
            .orWhere('CAST(publishedRevision.content AS text) ILIKE :search')
            // Revision mới nhất (bản CMS đang hiển thị) — để tìm được cả hiện vật nháp chưa publish.
            .orWhere(
              `(SELECT CAST(latest.content AS text) FROM exhibit_revisions latest
                WHERE latest.exhibit_id = exhibit.id
                ORDER BY latest.revision_no DESC LIMIT 1) ILIKE :search`,
            );
        }),
        { search },
      );
    }

    // Thùng rác: mới xóa trước; danh sách thường theo thứ tự hiển thị.
    if (query.deleted) qb.orderBy('exhibit.deletedAt', 'DESC').addOrderBy('exhibit.id', 'DESC');
    else qb.orderBy('exhibit.displayOrder', 'ASC').addOrderBy('exhibit.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /**
   * Tìm kiếm hiện vật CÔNG KHAI: chỉ bản đã xuất bản (APPROVED) + đang hiển thị, chưa xóa/lưu trữ.
   * Lọc theo `roomId` và từ khóa `q` (ILIKE trên tên phòng + nội dung bản published).
   * Sắp xếp ỔN ĐỊNH: `displayOrder ASC, id ASC` (tiebreaker duy nhất `id`) — union các trang
   * không trùng/sót. Trùng khớp với index `IDX_exhibits_room_order_id (roomId, displayOrder, id)`.
   */
  async searchPublicExhibits(
    query: Partial<PublicSearchQueryDto> = {},
  ): Promise<Paginated<Exhibit>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    // STUB (RED): chưa triển khai truy vấn — trả rỗng để biên dịch; test phải FAIL.
    return { items: [], total: 0, page, pageSize };
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
   * ID các hiện vật chưa xóa của phòng, khóa dòng (FOR UPDATE) để hai lần sắp xếp
   * đồng thời hoặc thêm/xóa hiện vật không chen vào giữa lúc kiểm tra và ghi.
   */
  async findIdsByRoomForUpdate(roomId: string, manager?: EntityManager): Promise<string[]> {
    const rows = await this.scoped(manager).find({
      select: { id: true },
      where: { roomId, isDeleted: false },
      lock: { mode: 'pessimistic_write' },
    });
    return rows.map((row) => row.id);
  }

  /**
   * Cập nhật thứ tự hiển thị display_order của hiện vật — chỉ khi hiện vật thuộc đúng phòng.
   */
  async updateDisplayOrder(
    id: string,
    roomId: string,
    displayOrder: number,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).update({ id, roomId }, { displayOrder });
  }

  /**
   * Xóa mềm hiện vật (BR-20 đã kiểm ở service): giữ nguyên revisions/hotspots để khôi phục và truy vết.
   * Mọi truy vấn hiện vật đều lọc `is_deleted = false`.
   */
  async markDeleted(exhibitIds: string[], manager: EntityManager): Promise<void> {
    await this.scoped(manager).update({ id: In(exhibitIds) }, { isDeleted: true, deletedAt: new Date() });
  }

  /** Khóa dòng hiện vật đang trong thùng rác (đã xóa mềm) để khôi phục. */
  lockDeletedById(id: string, manager: EntityManager): Promise<Exhibit | null> {
    return this.scoped(manager).findOne({ where: { id, isDeleted: true }, lock: { mode: 'pessimistic_write' } });
  }

  /** Thứ tự hiển thị lớn nhất trong các hiện vật chưa xóa của phòng (0 nếu phòng trống). */
  async maxDisplayOrder(roomId: string, manager: EntityManager): Promise<number> {
    const [row]: Array<{ max: number }> = await manager.query(
      'SELECT COALESCE(MAX(display_order), 0)::int AS max FROM exhibits WHERE room_id = $1 AND is_deleted = false',
      [roomId],
    );
    return row?.max ?? 0;
  }

  /** Bỏ xóa mềm hiện vật và đặt lại thứ tự hiển thị. */
  async markRestored(id: string, displayOrder: number, manager: EntityManager): Promise<void> {
    await this.scoped(manager).update({ id }, { isDeleted: false, deletedAt: null, displayOrder });
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
