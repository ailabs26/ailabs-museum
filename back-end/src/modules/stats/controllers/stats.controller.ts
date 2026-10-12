import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OverviewStatsDto } from '../dto/overview-stats.dto';
import { StatsService } from '../services/stats.service';

@ApiTags('Admin · Stats')
@ApiBearerAuth()
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Số liệu tổng quan Dashboard (phòng/hiện vật/chờ duyệt/báo cáo + hệ thống)' })
  overview(): Promise<OverviewStatsDto> {
    return this.stats.overview();
  }
}
