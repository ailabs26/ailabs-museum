import { OmitType } from '@nestjs/swagger';
import { ListAuditQueryDto } from './list-audit-query.dto';

/** Cùng bộ lọc với danh sách nhật ký, không phân trang (xuất toàn bộ kết quả khớp, có giới hạn). */
export class ExportAuditQueryDto extends OmitType(ListAuditQueryDto, ['page', 'pageSize', 'sort', 'q', 'skip'] as const) {}
