import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsModule } from '../rooms/rooms.module';
import { Exhibit } from './entities/exhibit.entity';
import { ExhibitRevision } from './entities/exhibit-revision.entity';
import { Hotspot } from './entities/hotspot.entity';
import { ExhibitsController } from './controllers/exhibits.controller';
import { ExhibitsService } from './services/exhibits.service';
import { ExhibitsRepository } from './repositories/exhibits.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exhibit, ExhibitRevision, Hotspot]),
    RoomsModule,
  ],
  controllers: [ExhibitsController],
  providers: [ExhibitsService, ExhibitsRepository],
  exports: [ExhibitsService, ExhibitsRepository],
})
export class ExhibitsModule {}

