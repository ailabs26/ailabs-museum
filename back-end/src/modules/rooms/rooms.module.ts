import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminRoomsController } from './controllers/admin-rooms.controller';
import { PublicRoomsController } from './controllers/public-rooms.controller';
import { Room } from './entities/room.entity';
import { RoomsRepository } from './repositories/rooms.repository';
import { RoomsService } from './services/rooms.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [AdminRoomsController, PublicRoomsController],
  providers: [RoomsRepository, RoomsService],
  exports: [RoomsRepository, RoomsService],
})
export class RoomsModule {}
