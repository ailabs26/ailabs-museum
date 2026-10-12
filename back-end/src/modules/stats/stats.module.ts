import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../rooms/entities/room.entity';
import { StatsController } from './controllers/stats.controller';
import { StatsService } from './services/stats.service';

/** Module số liệu thống kê cho Dashboard Admin (chỉ đọc). */
@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
