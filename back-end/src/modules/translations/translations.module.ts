import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicTranslationsController } from './controllers/public-translations.controller';
import { TranslationsController } from './controllers/translations.controller';
import { Translation } from './entities/translation.entity';
import { TranslationsRepository } from './repositories/translations.repository';
import { TranslationsService } from './services/translations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Translation])],
  controllers: [TranslationsController, PublicTranslationsController],
  providers: [TranslationsService, TranslationsRepository],
  exports: [TranslationsService],
})
export class TranslationsModule {}
