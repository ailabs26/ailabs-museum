import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OverviewStatsDto } from '../dto/overview-stats.dto';
import { StatsChartsDto } from '../dto/stats-charts.dto';
import { StorageStatsDto } from '../dto/storage-stats.dto';
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

  @Get('charts')
  @ApiOperation({ summary: 'Dữ liệu biểu đồ Dashboard (báo cáo/hiện vật/revision + hoạt động 14 ngày)' })
  charts(): Promise<StatsChartsDto> {
    return this.stats.charts();
  }

  @Get('storage')
  @ApiOperation({ summary: 'Dung lượng lưu trữ media theo từng loại tệp' })
  storage(): Promise<StorageStatsDto> {
    return this.stats.storage();
  }
}
