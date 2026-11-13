import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ContentReportStatus } from '../entities/content-report.entity';

/** Lọc danh sách báo cáo vi phạm theo trạng thái. */
export class ListReportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ContentReportStatus)
  status?: ContentReportStatus;
}
