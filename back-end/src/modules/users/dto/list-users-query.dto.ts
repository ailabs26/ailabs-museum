import { IsEnum, IsOptional } from 'class-validator';
import { DeletedFilter } from '../../../common/dto/deleted-filter.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { UserStatus } from '../entities/user.entity';

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @DeletedFilter()
  deleted?: boolean;
}
