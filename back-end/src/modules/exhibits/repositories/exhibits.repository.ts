import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';

@Injectable()
export class ExhibitsRepository {
  constructor(
    @InjectRepository(Exhibit)
    private readonly repository: Repository<Exhibit>,
  ) {}

  findByRoom(roomId: string): Promise<Exhibit[]> {
    return this.repository.find({
      where: {
        roomId,
        visibility: ExhibitVisibility.VISIBLE,
        isDeleted: false,
      },
      relations: {
        publishedRevision: {
          modelMedia: true,
          imageMedia: true,
          audioMedia: true,
          hotspots: true,
        },
      },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }
}
