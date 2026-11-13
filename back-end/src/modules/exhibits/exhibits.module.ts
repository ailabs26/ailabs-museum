import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '../media/media.module';
import { RoomsModule } from '../rooms/rooms.module';
import { Exhibit } from './entities/exhibit.entity';
import { ExhibitRevision } from './entities/exhibit-revision.entity';
import { Hotspot } from './entities/hotspot.entity';
import { AdminExhibitTransferController } from './controllers/admin-exhibit-transfer.controller';
import { AdminExhibitsController } from './controllers/admin-exhibits.controller';
import { ExhibitsController } from './controllers/exhibits.controller';
import { PublicExhibitsController } from './controllers/public-exhibits.controller';
import { PublicSitemapController } from './controllers/public-sitemap.controller';
import { ExhibitTransferService } from './services/exhibit-transfer.service';
import { ExhibitsService } from './services/exhibits.service';
import { RevisionPublishGate } from './services/revision-publish.gate';
import { ExhibitsRepository } from './repositories/exhibits.repository';
import { PublicModelsService } from './services/public-models.service';
import { ModelStorageService } from '../media/services/model-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exhibit, ExhibitRevision, Hotspot]),
    RoomsModule,
    MediaModule,
    NotificationsModule,
  ],
  // AdminExhibitTransferController đứng TRƯỚC AdminExhibitsController: `GET admin/exhibits/export` phải khớp trước `:id`.
  controllers: [ExhibitsController, PublicExhibitsController, PublicSitemapController, AdminExhibitTransferController, AdminExhibitsController],
  providers: [ExhibitsService, ExhibitTransferService, ExhibitsRepository, RevisionPublishGate, PublicModelsService, ModelStorageService],
  exports: [ExhibitsService, ExhibitsRepository, RevisionPublishGate, PublicModelsService],
})
export class ExhibitsModule {}

