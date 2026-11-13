import { ApiProperty } from '@nestjs/swagger';

/** Nhóm số liệu phòng trưng bày. */
export class RoomsStatsDto {
  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 9 })
  active!: number;

  @ApiProperty({ example: 3 })
  archived!: number;
}

/** Nhóm số liệu hiện vật. */
export class ExhibitsStatsDto {
  @ApiProperty({ example: 48 })
  total!: number;

  @ApiProperty({ example: 40 })
  visible!: number;

  @ApiProperty({ example: 8 })
  hidden!: number;
}

/** Nhóm số liệu revision (phục vụ cột "chờ duyệt"). */
export class RevisionsStatsDto {
  @ApiProperty({ example: 5, description: 'Revision đang chờ duyệt (in_review)' })
  inReview!: number;

  @ApiProperty({ example: 11, description: 'Revision bản nháp (draft)' })
  draft!: number;
}

/** Nhóm số liệu báo cáo vi phạm (phục vụ cột "báo cáo mở"). */
export class ReportsStatsDto {
  @ApiProperty({ example: 4, description: 'Báo cáo đang mở (open)' })
  open!: number;

  @ApiProperty({ example: 2, description: 'Báo cáo đang xử lý (in_progress)' })
  inProgress!: number;
}

/** Trạng thái sức khỏe hệ thống. */
export class SystemStatusDto {
  @ApiProperty({ example: 'up', enum: ['up'] })
  api!: 'up';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  db!: 'up' | 'down';

  @ApiProperty({ example: 38124, description: 'Thời gian chạy tiến trình API (giây)' })
  uptimeSec!: number;

  @ApiProperty({ example: '2026-10-12T08:30:00.000Z' })
  serverTime!: string;
}

/** Số liệu tổng quan cho Dashboard Admin (GET /admin/stats/overview). */
export class OverviewStatsDto {
  @ApiProperty({ type: RoomsStatsDto })
  rooms!: RoomsStatsDto;

  @ApiProperty({ type: ExhibitsStatsDto })
  exhibits!: ExhibitsStatsDto;

  @ApiProperty({ type: RevisionsStatsDto })
  revisions!: RevisionsStatsDto;

  @ApiProperty({ type: ReportsStatsDto })
  reports!: ReportsStatsDto;

  @ApiProperty({ type: SystemStatusDto })
  system!: SystemStatusDto;
}
