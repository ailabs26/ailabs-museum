import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { CreateReportDto } from '../dto/create-report.dto';
import { ContentReportsService } from '../services/content-reports.service';

@ApiTags('Public · Reports')
@Public()
@Controller('public/reports')
export class PublicReportsController {
  constructor(private readonly reports: ContentReportsService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Client gửi báo cáo nội dung sai (giới hạn cấu hình theo phút)' })
  create(@Body() dto: CreateReportDto) {
    return this.reports.create(dto);
  }
}
