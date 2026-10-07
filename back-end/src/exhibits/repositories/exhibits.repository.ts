import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exhibit } from '../exhibit.entity';

@Injectable()
export class ExhibitsRepository {
  constructor(@InjectRepository(Exhibit) private readonly repository: Repository<Exhibit>) {}

  findByRoom(roomId: string): Promise<Exhibit[]> {
    return this.repository.find({
      where: { roomId },
      relations: { model: true, image: true, audio: true },
      order: { displayOrder: 'ASC' },
    });
  }
}
