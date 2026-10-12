import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExhibitRevision } from '../exhibits/entities/exhibit-revision.entity';
import { Exhibit } from '../exhibits/entities/exhibit.entity';
import { ExhibitRevisionsController } from './controllers/exhibit-revisions.controller';
import { ModerationController } from './controllers/moderation.controller';
import { RevisionsController } from './controllers/revisions.controller';
import { ModerationRepository } from './repositories/moderation.repository';
import { ModerationService } from './services/moderation.service';

/** Phân hệ kiểm duyệt nội dung: duyệt/từ chối/ẩn revision + diff cũ/mới. */
@Module({
  imports: [TypeOrmModule.forFeature([Exhibit, ExhibitRevision])],
  controllers: [ModerationController, ExhibitRevisionsController, RevisionsController],
  providers: [ModerationService, ModerationRepository],
})
export class ModerationModule {}
