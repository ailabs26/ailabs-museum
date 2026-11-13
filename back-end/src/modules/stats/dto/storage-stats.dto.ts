import { ApiProperty } from '@nestjs/swagger';

/** Dung lượng & số tệp media theo một phân loại (model/image/audio/subtitle). */
export class StorageKindUsageDto {
  @ApiProperty({ example: 'model' })
  kind!: string;

  @ApiProperty({ example: 10485760, description: 'Tổng dung lượng (byte) của phân loại' })
  bytes!: number;

  @ApiProperty({ example: 4, description: 'Số tệp của phân loại' })
  count!: number;
}

/** Thống kê dung lượng lưu trữ media (GET /admin/stats/storage). */
export class StorageStatsDto {
  @ApiProperty({ type: [StorageKindUsageDto], description: 'Phân bổ dung lượng theo loại tệp' })
  byKind!: StorageKindUsageDto[];

  @ApiProperty({ example: 52428800, description: 'Tổng dung lượng media đang dùng (byte)' })
  totalBytes!: number;

  @ApiProperty({ example: 37, description: 'Tổng số tệp media' })
  totalCount!: number;
}
