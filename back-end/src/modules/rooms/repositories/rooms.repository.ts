import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Paginated } from '../../../common/types/paginated.type';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { Room, RoomStatus } from '../entities/room.entity';

@Injectable()
export class RoomsRepository extends BaseRepository<Room> {
  constructor(@InjectRepository(Room) repo: Repository<Room>) {
    super(repo);
  }

  /** Tìm phòng theo slug còn hoạt động (chưa bị xóa mềm). */
  async findBySlug(slug: string): Promise<Room | null> {
    return this.repo.findOne({
      where: { slug, isDeleted: false },
    });
  }

  /** Tìm phòng theo slug kể cả phòng đã xóa mềm (slug unique toàn bảng). */
  async findAnyBySlug(slug: string): Promise<Room | null> {
    return this.repo.findOne({ where: { slug } });
  }

  /** Tìm phòng đang hoạt động (active) theo slug cho khách tham quan. */
  async findActiveBySlug(slug: string): Promise<Room | null> {
    return this.liveExhibitsOnly(await this.repo.findOne({
      where: { slug, status: RoomStatus.ACTIVE, isDeleted: false },
      relations: { exhibits: true },
    }));
  }

  /** Tìm phòng kèm danh sách hiện vật để kiểm tra ràng buộc trước khi xóa (BR-20). */
  async findWithExhibits(id: string): Promise<Room | null> {
    return this.liveExhibitsOnly(await this.repo.findOne({
      where: { id, isDeleted: false },
      relations: { exhibits: true },
    }));
  }

  /** Tìm chi tiết một phòng theo ID còn hoạt động. */
  async findDetailById(id: string): Promise<Room | null> {
    return this.liveExhibitsOnly(await this.repo.findOne({
      where: { id, isDeleted: false },
      relations: { exhibits: true },
    }));
  }

  /** Kiểm tra sự tồn tại của slug chưa bị xóa. */
  async existsBySlug(slug: string): Promise<boolean> {
    return this.exists({ slug, isDeleted: false });
  }

  /** Lấy danh sách tất cả phòng công khai đang active cho 3D Canvas. */
  async findPublicRooms(): Promise<Room[]> {
    return (await this.repo.find({
      where: { status: RoomStatus.ACTIVE, isDeleted: false },
      relations: { exhibits: true },
      order: { createdAt: 'ASC' },
    })).map((room) => this.liveExhibitsOnly(room));
  }

  /**
   * Tìm kiếm, lọc và phân trang phòng trưng bày cho phân hệ Admin CMS.
   * Hỗ trợ tìm kiếm ILIKE theo name/slug, lọc status, nạp quan hệ exhibits.
   */
  async searchRooms(query: ListRoomsQueryDto): Promise<Paginated<Room>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const qb: SelectQueryBuilder<Room> = this.repo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.exhibits', 'exhibit')
      .where('room.isDeleted = :isDeleted', { isDeleted: query.deleted ?? false });

    if (query.status) {
      qb.andWhere('room.status = :status', { status: query.status });
    }

    if (query.q && query.q.trim()) {
      const search = `%${query.q.trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('room.name ILIKE :search', { search })
            .orWhere('room.slug ILIKE :search', { search });
        }),
      );
    }

    // Thùng rác: mới xóa trước.
    qb.orderBy(query.deleted ? 'room.deletedAt' : 'room.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map((room) => this.liveExhibitsOnly(room)), total, page, pageSize };
  }

  /** Khóa các phòng chưa xóa để xóa hàng loạt (chặn thêm hiện vật đồng thời qua FK exhibits → rooms). */
  lockActiveByIds(ids: string[], manager: EntityManager): Promise<Room[]> {
    return manager.getRepository(Room).find({
      where: { id: In(ids), isDeleted: false },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Khóa dòng các phòng đang trong thùng rác (đã xóa mềm) để khôi phục. */
  lockDeletedByIds(ids: string[], manager: EntityManager): Promise<Room[]> {
    return manager.getRepository(Room).find({
      where: { id: In(ids), isDeleted: true },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /**
   * Khóa chia sẻ (FOR SHARE) phòng theo ID, kể cả đã xóa: khôi phục hiện vật giữ khóa này để lệnh
   * xóa phòng chạy song song phải chờ rồi đếm cả hiện vật vừa khôi phục (BR-20).
   */
  lockForShare(id: string, manager: EntityManager): Promise<Room | null> {
    return manager.getRepository(Room).findOne({ where: { id }, lock: { mode: 'pessimistic_read' } });
  }

  async markRestored(ids: string[], manager: EntityManager): Promise<void> {
    await manager.getRepository(Room).update({ id: In(ids) }, { isDeleted: false, deletedAt: null });
  }

  /** Số hiện vật chưa xóa mềm trong từng phòng (BR-20). */
  async countLiveExhibits(ids: string[], manager: EntityManager): Promise<Map<string, number>> {
    const rows: Array<{ roomId: string; count: number }> = await manager.query(
      'SELECT room_id AS "roomId", COUNT(*)::int AS count FROM exhibits WHERE room_id = ANY($1) AND is_deleted = false GROUP BY room_id',
      [ids],
    );
    return new Map(rows.map((row) => [row.roomId, row.count]));
  }

  async markDeleted(ids: string[], manager: EntityManager): Promise<void> {
    await manager.getRepository(Room).update({ id: In(ids) }, { isDeleted: true, deletedAt: new Date() });
  }

  /**
   * Hiện vật đã xóa mềm không còn thuộc phòng: bỏ khỏi quan hệ đã nạp để số đếm, BR-20 và
   * giao diện chỉ thấy hiện vật còn sống.
   */
  private liveExhibitsOnly<T extends Room | null>(room: T): T {
    if (room?.exhibits) room.exhibits = room.exhibits.filter((exhibit) => !exhibit.isDeleted);
    return room;
  }
}

