import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  /** Số liệu tổng quan cho các thẻ StatCard + trạng thái hệ thống. */
  async overview(): Promise<OverviewStatsDto> {
    const rooms = await this.roomsStats();

    return {
      rooms,
      exhibits: { total: 0, visible: 0, hidden: 0 },
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
}
