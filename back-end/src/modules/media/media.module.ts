import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminMediaController } from './controllers/admin-media.controller';
import { MediaDeliveryController } from './controllers/media-delivery.controller';
import { Media } from './entities/media.entity';
import { MediaRepository } from './repositories/media.repository';
import { MediaInspectionService } from './services/media-inspection.service';
import {
  DEFAULT_MEDIA_STORAGE_ROOTS,
  MEDIA_STORAGE_ROOTS,
  MediaStorageService,
} from './services/media-storage.service';
import { MediaService } from './services/media.service';
import { MediaDeliveryService } from './services/media-delivery.service';
import { MediaReferenceValidator } from './services/media-reference.validator';
import { MEDIA_URL_OPTIONS, MediaUrlOptions, MediaUrlService } from './services/media-url.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [AdminMediaController, MediaDeliveryController],
  providers: [
    MediaRepository,
    MediaService,
    MediaInspectionService,
    MediaStorageService,
    MediaUrlService,
    MediaReferenceValidator,
    MediaDeliveryService,
    { provide: MEDIA_STORAGE_ROOTS, useValue: DEFAULT_MEDIA_STORAGE_ROOTS },
    {
      provide: MEDIA_URL_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MediaUrlOptions => ({
        publicBaseUrl: config.getOrThrow<string>('media.publicBaseUrl'),
        signingSecret: config.getOrThrow<string>('media.urlSigningSecret'),
        signedUrlTtlSeconds: config.getOrThrow<number>('media.signedUrlTtlSeconds'),
      }),
    },
  ],
  exports: [MediaRepository, MediaService, MediaUrlService, MediaReferenceValidator],
})
export class MediaModule {}
