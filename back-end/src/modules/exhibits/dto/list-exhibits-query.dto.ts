import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ExhibitVisibility } from '../entities/exhibit.entity';

export enum ExhibitStatusFilter {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ALL = 'all',
}

export class ListExhibitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'roomId phải là định dạng UUID hợp lệ' })
  roomId?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'all'], {
    message: 'Trạng thái lọc phải là draft, published hoặc all',
  })
  status?: 'draft' | 'published' | 'all';

  @IsOptional()
  @IsEnum(ExhibitVisibility, {
    message: 'Trạng thái hiển thị phải là visible hoặc hidden',
  })
  visibility?: ExhibitVisibility;
}

