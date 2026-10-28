import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerApiKeysController } from './controllers/partner-api-keys.controller';
import { PartnerApiKey } from './entities/partner-api-key.entity';
import { PartnerApiKeysRepository } from './repositories/partner-api-keys.repository';
import { PartnerApiKeysService } from './services/partner-api-keys.service';

@Module({
  imports: [TypeOrmModule.forFeature([PartnerApiKey])],
  controllers: [PartnerApiKeysController],
  providers: [PartnerApiKeysService, PartnerApiKeysRepository],
  exports: [PartnerApiKeysService],
})
export class PartnerApiKeysModule {}
