import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { ExhibitsRepository } from './repositories/exhibits.repository';

@Injectable()
export class ExhibitsService {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    private readonly exhibits: ExhibitsRepository,
  ) {}

  async roomsList(): Promise<Room[]> {
    return this.rooms.find({ order: { name: 'ASC' } });
  }

  async roomWithExhibits(slug: string) {
    const room = await this.rooms.findOneBy({ slug });
    if (!room) throw new NotFoundException('Không tìm thấy phòng trưng bày');
    return { ...room, exhibits: await this.exhibits.findByRoom(room.id) };
  }
}
