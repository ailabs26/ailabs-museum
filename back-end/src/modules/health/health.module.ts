import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Health check: liveness `/health`, readiness `/health/ready` (kiểm tra DB). */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
