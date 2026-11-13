import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentReport } from '../content-reports/entities/content-report.entity';
import { ExhibitRevision } from '../exhibits/entities/exhibit-revision.entity';
import { Exhibit } from '../exhibits/entities/exhibit.entity';
import { Media } from '../media/entities/media.entity';
import { Room } from '../rooms/entities/room.entity';
import { StatsController } from './controllers/stats.controller';
import { StatsService } from './services/stats.service';

/** Module số liệu thống kê cho Dashboard Admin (chỉ đọc). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Room, Exhibit, ExhibitRevision, ContentReport, Media]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
