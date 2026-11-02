import { Controller, Get, Header, Param, ParseUUIDPipe, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { auditClientInfo } from '../audit-request.util';
import { ExportAuditQueryDto } from '../dto/export-audit-query.dto';
import { ListAuditQueryDto } from '../dto/list-audit-query.dto';
import { AuditService } from '../services/audit.service';

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

  // Đặt trước ':id' để "export" không bị hiểu là id.
  @Get('export')
  @Permissions(PERMISSIONS.AUDIT_READ)
  @Header('Cache-Control', 'no-store')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Xuất nhật ký ra CSV (UTF-8 có BOM), cùng bộ lọc với danh sách; tối đa 10.000 dòng' })
  @ApiBadRequestResponse({ description: 'Quá 10.000 bản ghi khớp bộ lọc.' })
  async export(
    @Query() query: ExportAuditQueryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const csv = await this.audit.exportCsv(query, user.id, auditClientInfo(req));
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="audit-logs-${stamp}.csv"`,
    });
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Chi tiết một bản ghi nhật ký' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.getById(id);
  }
}
