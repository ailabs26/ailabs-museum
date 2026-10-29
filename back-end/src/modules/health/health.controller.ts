import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly health: HealthService) {}

  /** Liveness: process còn chạy (không chạm DB, để proxy không khởi động lại app khi DB chập chờn). */
  @Get()
  @ApiOperation({ summary: 'Liveness — process còn chạy' })
  getHealth() {
    return { status: 'ok' };
  }

  /** Readiness: DB trả lời được → 200; không → 503 (không lộ chi tiết lỗi DB ra ngoài). */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness — kiểm tra kết nối database' })
  async getReadiness() {
    try {
      const latencyMs = await this.health.pingDatabase();
      return { status: 'ok', db: 'up', latencyMs };
    } catch (error) {
      this.logger.warn(`Database không sẵn sàng: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Cơ sở dữ liệu không sẵn sàng');
    }
  }
}
