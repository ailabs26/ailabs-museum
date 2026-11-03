import { IsEnum, IsOptional } from 'class-validator';
import { DeletedFilter } from '../../../common/dto/deleted-filter.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { RoomStatus } from '../entities/room.entity';

export class ListRoomsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Trạng thái phòng phải là active hoặc archived' })
  status?: RoomStatus;

  @DeletedFilter()
  deleted?: boolean;
}
