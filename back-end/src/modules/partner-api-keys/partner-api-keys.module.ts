import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExhibitsModule } from '../exhibits/exhibits.module';
import { PartnerApiController } from './controllers/partner-api.controller';
import { PartnerApiKeysController } from './controllers/partner-api-keys.controller';
import { PartnerApiKeyGuard } from './guards/partner-api-key.guard';
import { PartnerApiKey } from './entities/partner-api-key.entity';
import { PartnerApiKeysRepository } from './repositories/partner-api-keys.repository';
import { PartnerApiKeysService } from './services/partner-api-keys.service';
import { PartnerRateLimiter } from './services/partner-rate-limiter.service';

@Module({
  imports: [TypeOrmModule.forFeature([PartnerApiKey]), ExhibitsModule],
  controllers: [PartnerApiKeysController, PartnerApiController],
  providers: [PartnerApiKeysService, PartnerApiKeysRepository, PartnerRateLimiter, PartnerApiKeyGuard],
  exports: [PartnerApiKeysService],
})
export class PartnerApiKeysModule {}
