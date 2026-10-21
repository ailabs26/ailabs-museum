import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminMediaController } from './controllers/admin-media.controller';
import { MediaDeliveryController } from './controllers/media-delivery.controller';
import { Media } from './entities/media.entity';
import { MediaRepository } from './repositories/media.repository';
import { MediaInspectionService } from './services/media-inspection.service';
import { MediaStorageService } from './services/media-storage.service';
import { MediaService } from './services/media.service';
import { MediaDeliveryService } from './services/media-delivery.service';
import { MediaReferenceValidator } from './services/media-reference.validator';
import { MEDIA_URL_OPTIONS, MediaUrlOptions, MediaUrlService } from './services/media-url.service';
import { LocalStorageDriver } from './storage/local-storage.driver';
import { MEDIA_STORAGE_DRIVER, MediaStorageDriver } from './storage/media-storage-driver';
import { SupabaseStorageDriver } from './storage/supabase-storage.driver';

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
    {
      // Chọn nơi lưu file theo env MEDIA_STORAGE_DRIVER (mặc định đĩa cục bộ).
      provide: MEDIA_STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MediaStorageDriver =>
        config.get<string>('media.storageDriver') === 'supabase'
          ? new SupabaseStorageDriver({
              url: config.getOrThrow<string>('media.supabase.url'),
              serviceKey: config.getOrThrow<string>('media.supabase.serviceKey'),
              bucket: config.getOrThrow<string>('media.supabase.bucket'),
            })
          : new LocalStorageDriver(),
    },
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
