import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../rooms/entities/room.entity';
import { Exhibit } from './entities/exhibit.entity';
import { ExhibitRevision } from './entities/exhibit-revision.entity';
import { Hotspot } from './entities/hotspot.entity';
import { ExhibitsController } from './controllers/exhibits.controller';
import { ExhibitsService } from './services/exhibits.service';
import { ExhibitsRepository } from './repositories/exhibits.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Exhibit, ExhibitRevision, Hotspot])],
  controllers: [ExhibitsController],
  providers: [ExhibitsService, ExhibitsRepository],
  exports: [ExhibitsRepository],
})
export class ExhibitsModule {}
