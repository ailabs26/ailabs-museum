import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../rooms/room.entity';
import { Exhibit } from './exhibit.entity';
import { ExhibitsController } from './exhibits.controller';
import { ExhibitsService } from './exhibits.service';
import { ExhibitsRepository } from './repositories/exhibits.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Exhibit])],
  controllers: [ExhibitsController],
  providers: [ExhibitsService, ExhibitsRepository],
})
export class ExhibitsModule {}
