import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Lọc hàng chờ kiểm duyệt (revision in_review). */
export class ListQueueQueryDto extends PaginationQueryDto {
  /** Lọc theo phòng của hiện vật. */
  @IsOptional()
  @IsUUID('4')
  roomId?: string;
}
