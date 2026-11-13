import { ApiProperty } from '@nestjs/swagger';

/** Một lát cắt theo nhãn (dùng cho Pie/Bar/Column). */
export class LabeledCountDto {
  @ApiProperty({ example: 'open' })
  label!: string;

  @ApiProperty({ example: 7 })
  count!: number;
}

/** Một điểm theo ngày cho biểu đồ hoạt động (Mixed line + column). */
export class ActivityPointDto {
  @ApiProperty({ example: '2026-10-12' })
  date!: string;

  @ApiProperty({ example: 3 })
  revisions!: number;

  @ApiProperty({ example: 1 })
  reports!: number;
}

/** Dữ liệu biểu đồ cho Dashboard (GET /admin/stats/charts). */
export class StatsChartsDto {
  @ApiProperty({ type: [LabeledCountDto], description: 'Báo cáo theo trạng thái → Pie/Donut' })
  reportsByStatus!: LabeledCountDto[];

  @ApiProperty({ type: [LabeledCountDto], description: 'Hiện vật theo phòng → Bar' })
  exhibitsByRoom!: LabeledCountDto[];

  @ApiProperty({ type: [LabeledCountDto], description: 'Revision theo state → Column' })
  revisionsByState!: LabeledCountDto[];

  @ApiProperty({ type: [ActivityPointDto], description: 'Hoạt động 14 ngày gần nhất → Mixed' })
  activityLast14Days!: ActivityPointDto[];
}
