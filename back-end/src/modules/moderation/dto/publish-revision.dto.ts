import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** Xuất bản revision — kèm version của hiện vật mà client đang thấy (optimistic lock). */
export class PublishRevisionDto {
  @ApiProperty({ example: 3, description: 'Phiên bản hiện vật phía client đang xem' })
  @IsInt()
  @Min(0)
  version!: number;
}
