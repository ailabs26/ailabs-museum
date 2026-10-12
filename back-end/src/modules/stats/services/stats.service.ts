import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exhibit, ExhibitVisibility } from '../../exhibits/entities/exhibit.entity';
import { Room, RoomStatus } from '../../rooms/entities/room.entity';
import { OverviewStatsDto } from '../dto/overview-stats.dto';

/**
 * Tổng hợp số liệu cho Dashboard Admin.
 * Chỉ ĐỌC (count/group-by) trên các bảng có sẵn — không đổi schema.
 */
@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(Exhibit) private readonly exhibits: Repository<Exhibit>,
  ) {}

  /** Số liệu tổng quan cho các thẻ StatCard + trạng thái hệ thống. */
  async overview(): Promise<OverviewStatsDto> {
    const [rooms, exhibits] = await Promise.all([
      this.roomsStats(),
      this.exhibitsStats(),
    ]);

    return {
      rooms,
      exhibits,
      revisions: { inReview: 0, draft: 0 },
      reports: { open: 0, inProgress: 0 },
      system: { api: 'up', db: 'up', uptimeSec: 0, serverTime: new Date().toISOString() },
    };
  }

  /** Đếm phòng trưng bày theo trạng thái (bỏ qua bản đã xóa mềm). */
  private async roomsStats(): Promise<OverviewStatsDto['rooms']> {
    const [total, active, archived] = await Promise.all([
      this.rooms.count({ where: { isDeleted: false } }),
      this.rooms.count({ where: { isDeleted: false, status: RoomStatus.ACTIVE } }),
      this.rooms.count({ where: { isDeleted: false, status: RoomStatus.ARCHIVED } }),
    ]);
    return { total, active, archived };
  }

  /** Đếm hiện vật theo khả năng hiển thị (bỏ qua bản đã xóa mềm). */
  private async exhibitsStats(): Promise<OverviewStatsDto['exhibits']> {
    const [total, visible, hidden] = await Promise.all([
      this.exhibits.count({ where: { isDeleted: false } }),
      this.exhibits.count({ where: { isDeleted: false, visibility: ExhibitVisibility.VISIBLE } }),
      this.exhibits.count({ where: { isDeleted: false, visibility: ExhibitVisibility.HIDDEN } }),
    ]);
    return { total, visible, hidden };
  }
}
