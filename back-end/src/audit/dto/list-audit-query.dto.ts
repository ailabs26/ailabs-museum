import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  resourceType?: string;

  /** Lọc occurredAt >= from (ISO 8601 UTC). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Lọc occurredAt <= to (ISO 8601 UTC). */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
