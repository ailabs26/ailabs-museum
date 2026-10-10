import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions.constant';
import { Permissions } from '../core/auth/permissions.decorator';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';
import { AuditService } from './audit.service';

@ApiTags('Admin · Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Nhật ký hệ thống (lọc actor/action/resource/thời gian)' })
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Chi tiết một bản ghi nhật ký' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.getById(id);
  }
}
