import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Giao báo cáo: bỏ trống = tự tiếp nhận; có `assigneeId` = giao cho người khác (phải có quyền xử lý báo cáo). */
export class AssignReportDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Người được giao; bỏ trống để tự tiếp nhận' })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string;
}
