import { Room, RoomStatus } from '../entities/room.entity';

export interface RoomResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: RoomStatus;
  exhibitsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RoomResponseDto implements RoomResponse {
  id!: string;
  slug!: string;
  name!: string;
  description!: string | null;
  status!: RoomStatus;
  exhibitsCount!: number;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: Room, exhibitsCount?: number): RoomResponseDto {
    const dto = new RoomResponseDto();
    dto.id = entity.id;
    dto.slug = entity.slug;
    dto.name = entity.name;
    dto.description = entity.description ?? null;
    dto.status = entity.status;
    dto.exhibitsCount =
      exhibitsCount !== undefined
        ? exhibitsCount
        : entity.exhibits
          ? entity.exhibits.length
          : 0;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export function toRoomResponse(
  room: Room,
  exhibitsCount?: number,
): RoomResponse {
  return RoomResponseDto.fromEntity(room, exhibitsCount);
}
