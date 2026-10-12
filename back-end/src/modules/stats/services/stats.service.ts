import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContentReport,
  ContentReportStatus,
} from '../../content-reports/entities/content-report.entity';
import {
  ExhibitRevision,
  RevisionState,
} from '../../exhibits/entities/exhibit-revision.entity';
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
    @InjectRepository(ExhibitRevision)
    private readonly revisions: Repository<ExhibitRevision>,
    @InjectRepository(ContentReport)
    private readonly reports: Repository<ContentReport>,
  ) {}

  /** Số liệu tổng quan cho các thẻ StatCard + trạng thái hệ thống. */
  async overview(): Promise<OverviewStatsDto> {
    const [rooms, exhibits, revisions, reports] = await Promise.all([
      this.roomsStats(),
      this.exhibitsStats(),
      this.revisionsStats(),
      this.reportsStats(),
    ]);

    return {
      rooms,
      exhibits,
      revisions,
      reports,
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

  /** Đếm revision theo trạng thái phục vụ cột "chờ duyệt". */
  private async revisionsStats(): Promise<OverviewStatsDto['revisions']> {
    const [inReview, draft] = await Promise.all([
      this.revisions.count({ where: { state: RevisionState.IN_REVIEW } }),
      this.revisions.count({ where: { state: RevisionState.DRAFT } }),
    ]);
    return { inReview, draft };
  }

  /** Đếm báo cáo vi phạm chưa đóng phục vụ cột "báo cáo mở". */
  private async reportsStats(): Promise<OverviewStatsDto['reports']> {
    const [open, inProgress] = await Promise.all([
      this.reports.count({ where: { status: ContentReportStatus.OPEN } }),
      this.reports.count({ where: { status: ContentReportStatus.IN_PROGRESS } }),
    ]);
    return { open, inProgress };
  }
}
