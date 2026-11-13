import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Ẩn/hiện hiện vật — kèm version optimistic lock và lý do tùy chọn. */
export class HideExhibitDto {
  @ApiProperty({ example: 3, description: 'Phiên bản hiện vật phía client đang xem' })
  @IsInt()
  @Min(0)
  version!: number;

  @ApiProperty({
    required: false,
    example: 'Tạm ẩn để bảo dưỡng thông tin hiện vật',
    description: 'Lý do tạm ẩn hoặc mở lại hiện vật (ghi vào nhật ký hệ thống)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
