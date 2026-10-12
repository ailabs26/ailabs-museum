import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** Ẩn/hiện hiện vật — kèm version optimistic lock. */
export class HideExhibitDto {
  @ApiProperty({ example: 3, description: 'Phiên bản hiện vật phía client đang xem' })
  @IsInt()
  @Min(0)
  version!: number;
}
