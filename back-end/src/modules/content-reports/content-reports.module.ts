import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { Exhibit } from '../exhibits/entities/exhibit.entity';
import { ExhibitRevision } from '../exhibits/entities/exhibit-revision.entity';
import { ContentReport } from './entities/content-report.entity';
import { PublicReportsController } from './controllers/public-reports.controller';
import { ReportsController } from './controllers/reports.controller';
import { ContentReportsRepository } from './repositories/content-reports.repository';
import { ContentReportsService } from './services/content-reports.service';

export function publicReportsThrottleOptions(config: ConfigService) {
  return [{ ttl: 60_000, limit: config.getOrThrow<number>('reports.publicRateLimit') }];
}

/** Phân hệ báo cáo vi phạm: Client gửi (public, rate-limit) + Admin xử lý. */
@Module({
  imports: [
    TypeOrmModule.forFeature([ContentReport, Exhibit, ExhibitRevision]),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: publicReportsThrottleOptions,
    }),
  ],
  controllers: [ReportsController, PublicReportsController],
  providers: [ContentReportsService, ContentReportsRepository],
})
export class ContentReportsModule {}
