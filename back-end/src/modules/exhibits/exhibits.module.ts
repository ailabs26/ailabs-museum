import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '../media/media.module';
import { RoomsModule } from '../rooms/rooms.module';
import { Exhibit } from './entities/exhibit.entity';
import { ExhibitRevision } from './entities/exhibit-revision.entity';
import { Hotspot } from './entities/hotspot.entity';
import { AdminExhibitsController } from './controllers/admin-exhibits.controller';
import { ExhibitsController } from './controllers/exhibits.controller';
import { ExhibitsService } from './services/exhibits.service';
import { RevisionPublishGate } from './services/revision-publish.gate';
import { ExhibitsRepository } from './repositories/exhibits.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exhibit, ExhibitRevision, Hotspot]),
    RoomsModule,
    MediaModule,
  ],
  controllers: [ExhibitsController, AdminExhibitsController],
  providers: [ExhibitsService, ExhibitsRepository, RevisionPublishGate],
  exports: [ExhibitsService, ExhibitsRepository, RevisionPublishGate],
})
export class ExhibitsModule {}

