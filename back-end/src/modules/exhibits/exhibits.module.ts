import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsModule } from '../rooms/rooms.module';
import { Exhibit } from './entities/exhibit.entity';
import { ExhibitRevision } from './entities/exhibit-revision.entity';
import { Hotspot } from './entities/hotspot.entity';
import { AdminExhibitsController } from './controllers/admin-exhibits.controller';
import { ExhibitsController } from './controllers/exhibits.controller';
import { ExhibitsService } from './services/exhibits.service';
import { ExhibitsRepository } from './repositories/exhibits.repository';
import { PublicModelsService } from './services/public-models.service';
import { ModelStorageService } from '../media/services/model-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exhibit, ExhibitRevision, Hotspot]),
    RoomsModule,
  ],
  controllers: [ExhibitsController, AdminExhibitsController],
  providers: [ExhibitsService, ExhibitsRepository, PublicModelsService, ModelStorageService],
  exports: [ExhibitsService, ExhibitsRepository],
})
export class ExhibitsModule {}

