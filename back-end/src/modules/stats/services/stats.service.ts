import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
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
import {
  ActivityPointDto,
  LabeledCountDto,
  StatsChartsDto,
} from '../dto/stats-charts.dto';

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
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Số liệu tổng quan cho các thẻ StatCard + trạng thái hệ thống. */
  async overview(): Promise<OverviewStatsDto> {
    const [rooms, exhibits, revisions, reports, system] = await Promise.all([
      this.roomsStats(),
      this.exhibitsStats(),
      this.revisionsStats(),
      this.reportsStats(),
      this.systemStatus(),
    ]);

    return { rooms, exhibits, revisions, reports, system };
  }

  /** Dữ liệu cho các biểu đồ ApexCharts trên Dashboard. */
  async charts(): Promise<StatsChartsDto> {
    const [reportsByStatus, exhibitsByRoom, revisionsByState, activityLast14Days] =
      await Promise.all([
        this.reportsByStatus(),
        this.exhibitsByRoom(),
        this.revisionsByState(),
        this.activityLast14Days(),
      ]);
    return { reportsByStatus, exhibitsByRoom, revisionsByState, activityLast14Days };
  }

  /** Báo cáo gộp theo trạng thái (Pie/Donut). */
  private async reportsByStatus(): Promise<LabeledCountDto[]> {
    const rows = await this.reports
      .createQueryBuilder('r')
      .select('r.status', 'label')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status')
      .getRawMany<{ label: string; count: string }>();
    return rows.map((row) => ({ label: row.label, count: Number(row.count) }));
  }

  /** Hiện vật gộp theo phòng (Bar), bỏ bản xóa mềm. */
  private async exhibitsByRoom(): Promise<LabeledCountDto[]> {
    const rows = await this.exhibits
      .createQueryBuilder('e')
      .innerJoin('e.room', 'room')
      .select('room.name', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('e.isDeleted = :deleted', { deleted: false })
      .groupBy('room.name')
      .orderBy('count', 'DESC')
      .getRawMany<{ label: string; count: string }>();
    return rows.map((row) => ({ label: row.label, count: Number(row.count) }));
  }

  /** Revision gộp theo trạng thái (Column). */
  private async revisionsByState(): Promise<LabeledCountDto[]> {
    const rows = await this.revisions
      .createQueryBuilder('rev')
      .select('rev.state', 'label')
      .addSelect('COUNT(*)', 'count')
      .groupBy('rev.state')
      .getRawMany<{ label: string; count: string }>();
    return rows.map((row) => ({ label: row.label, count: Number(row.count) }));
  }

  /** Hoạt động 14 ngày gần nhất: số revision tạo mới vs báo cáo gửi (Mixed). */
  private async activityLast14Days(): Promise<ActivityPointDto[]> {
    const days = 14;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [revByDay, repByDay] = await Promise.all([
      this.dailyCounts(this.revisions.createQueryBuilder('x'), since),
      this.dailyCounts(this.reports.createQueryBuilder('x'), since),
    ]);

    const series: ActivityPointDto[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({
        date: key,
        revisions: revByDay.get(key) ?? 0,
        reports: repByDay.get(key) ?? 0,
      });
    }
    return series;
  }

  /** Gộp số bản ghi theo ngày (UTC) từ cột created_at kể từ `since`. */
  private async dailyCounts(
    qb: SelectQueryBuilder<ObjectLiteral>,
    since: Date,
  ): Promise<Map<string, number>> {
    const rows = await qb
      .select("TO_CHAR(x.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('x.created_at >= :since', { since })
      .groupBy('day')
      .getRawMany<{ day: string; count: string }>();
    return new Map(rows.map((row) => [row.day, Number(row.count)]));
  }

  /** Trạng thái hệ thống: API luôn up (đang phản hồi), DB check SELECT 1, uptime tiến trình. */
  private async systemStatus(): Promise<OverviewStatsDto['system']> {
    let db: 'up' | 'down' = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      db = 'down';
    }
    return {
      api: 'up',
      db,
      uptimeSec: Math.floor(process.uptime()),
      serverTime: new Date().toISOString(),
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
