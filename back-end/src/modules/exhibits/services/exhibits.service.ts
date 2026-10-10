import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevisionState } from '../entities/exhibit-revision.entity';
import { Room, RoomStatus } from '../../rooms/entities/room.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';

@Injectable()
export class ExhibitsService {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    private readonly exhibits: ExhibitsRepository,
  ) {}

  async roomsList(): Promise<Room[]> {
    return this.rooms.find({
      where: { status: RoomStatus.ACTIVE, isDeleted: false },
      order: { name: 'ASC' },
    });
  }

  async roomWithExhibits(slug: string) {
    const room = await this.rooms.findOneBy({
      slug,
      status: RoomStatus.ACTIVE,
      isDeleted: false,
    });

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    const exhibits = (await this.exhibits.findByRoom(room.id)).flatMap(
      (exhibit) => {
        const revision = exhibit.publishedRevision;

        if (!revision || revision.state !== RevisionState.APPROVED) {
          return [];
        }

        const content = revision.content;

        return [
          {
            id: exhibit.id,
            roomId: exhibit.roomId,
            displayOrder: exhibit.displayOrder,
            name: content.name,
            description: content.description,
            positionX: content.position.x,
            positionY: content.position.y,
            positionZ: content.position.z,
            transcript: content.transcript ?? null,
            placeholderShape: content.placeholderShape ?? 'box',
            placeholderColor: content.placeholderColor ?? '#8b7355',
            hotspots: revision.hotspots
              .map((hotspot) => ({
                id: hotspot.id,
                label: hotspot.label,
                body: hotspot.body,
                positionX: Number(hotspot.positionX),
                positionY: Number(hotspot.positionY),
                positionZ: Number(hotspot.positionZ),
                displayOrder: hotspot.displayOrder,
              }))
              .sort((left, right) => left.displayOrder - right.displayOrder),
            model: null,
            image: null,
            audio: null,
          },
        ];
      },
    );

    return {
      id: room.id,
      slug: room.slug,
      name: room.name,
      description: room.description,
      exhibits,
    };
  }
}
