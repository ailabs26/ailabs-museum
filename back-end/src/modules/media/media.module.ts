import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminMediaController } from './controllers/admin-media.controller';
import { Media } from './entities/media.entity';
import { MediaRepository } from './repositories/media.repository';
import { MediaInspectionService } from './services/media-inspection.service';
import {
  DEFAULT_MEDIA_STORAGE_ROOTS,
  MEDIA_STORAGE_ROOTS,
  MediaStorageService,
} from './services/media-storage.service';
import { MediaService } from './services/media.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [AdminMediaController],
  providers: [
    MediaRepository,
    MediaService,
    MediaInspectionService,
    MediaStorageService,
    { provide: MEDIA_STORAGE_ROOTS, useValue: DEFAULT_MEDIA_STORAGE_ROOTS },
  ],
  exports: [MediaRepository, MediaService],
})
export class MediaModule {}
