import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AssignReportDto } from '../dto/assign-report.dto';
import { ListReportsQueryDto } from '../dto/list-reports-query.dto';
import { ResolveReportDto } from '../dto/resolve-report.dto';
import { ContentReportsService } from '../services/content-reports.service';

@ApiTags('Admin · Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ContentReportsService) {}

  @Get()
  @Permissions(PERMISSIONS.REPORT_READ)
  @ApiOperation({ summary: 'Danh sách báo cáo vi phạm (lọc theo trạng thái)' })
  list(@Query() query: ListReportsQueryDto) {
    return this.reports.list(query);
  }

  // Đặt trước ':id' để "assignees" không bị hiểu là id.
  @Get('assignees')
  @Permissions(PERMISSIONS.REPORT_RESOLVE)
  @ApiOperation({ summary: 'Người có thể được giao báo cáo (user active có quyền report:resolve)' })
  assignees() {
    return this.reports.assignees();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.REPORT_READ)
  @ApiOperation({ summary: 'Chi tiết báo cáo + phiên bản bị báo cáo' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.get(id);
  }

  @Post(':id/assign')
  @Permissions(PERMISSIONS.REPORT_RESOLVE)
  @Audit('report.assign', 'report')
  @ApiOperation({ summary: 'Tiếp nhận (bỏ trống assigneeId) hoặc giao báo cáo cho người khác (open/in_progress → in_progress)' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.assign(id, user, dto.assigneeId);
  }

  @Post(':id/resolve')
  @Permissions(PERMISSIONS.REPORT_RESOLVE)
  @Audit('report.resolve', 'report')
  @ApiOperation({ summary: 'Xử lý xong báo cáo (→ resolved)' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.resolve(id, dto, user);
  }

  @Post(':id/dismiss')
  @Permissions(PERMISSIONS.REPORT_RESOLVE)
  @Audit('report.dismiss', 'report')
  @ApiOperation({ summary: 'Đóng/bác báo cáo (→ dismissed)' })
  dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.dismiss(id, dto, user);
  }
}
