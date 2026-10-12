import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
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

  /** Tìm phòng đang hoạt động (active) theo slug cho khách tham quan. */
  async findActiveBySlug(slug: string): Promise<Room | null> {
    return this.repo.findOne({
      where: { slug, status: RoomStatus.ACTIVE, isDeleted: false },
      relations: { exhibits: true },
    });
  }

  /** Tìm phòng kèm danh sách hiện vật để kiểm tra ràng buộc trước khi xóa (BR-20). */
  async findWithExhibits(id: string): Promise<Room | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: { exhibits: true },
    });
  }

  /** Tìm chi tiết một phòng theo ID còn hoạt động. */
  async findDetailById(id: string): Promise<Room | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: { exhibits: true },
    });
  }

  /** Kiểm tra sự tồn tại của slug chưa bị xóa. */
  async existsBySlug(slug: string): Promise<boolean> {
    return this.exists({ slug, isDeleted: false });
  }

  /** Lấy danh sách tất cả phòng công khai đang active cho 3D Canvas. */
  async findPublicRooms(): Promise<Room[]> {
    return this.repo.find({
      where: { status: RoomStatus.ACTIVE, isDeleted: false },
      relations: { exhibits: true },
      order: { createdAt: 'ASC' },
    });
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
      .where('room.isDeleted = :isDeleted', { isDeleted: false });

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

    qb.orderBy('room.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }
}
