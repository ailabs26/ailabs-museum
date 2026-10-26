import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { assertNothingBlocked, type BlockedDeletion } from '../../../common/exceptions/deletion-blocked';
import { Paginated } from '../../../common/types/paginated.type';
import { CreateRoomDto } from '../dto/create-room.dto';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { RoomResponse, toRoomResponse } from '../dto/room-response.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { Room } from '../entities/room.entity';
import { RoomsRepository } from '../repositories/rooms.repository';

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomsRepo: RoomsRepository,
    private readonly tx: TransactionManager,
  ) {}

  /** Lấy danh sách phòng trưng bày có phân trang & tìm kiếm cho Admin CMS. */
  async list(query: ListRoomsQueryDto): Promise<Paginated<RoomResponse>> {
    const result = await this.roomsRepo.searchRooms(query);
    return {
      ...result,
      items: result.items.map((room) => toRoomResponse(room)),
    };
  }

  /** Lấy thông tin chi tiết một phòng theo ID cho Admin CMS. */
  async getById(id: string): Promise<RoomResponse> {
    const room = await this.roomsRepo.findWithExhibits(id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }
    return toRoomResponse(room);
  }

  /** Lấy danh sách phòng công khai (status: active, isDeleted: false) cho khách tham quan. */
  async getPublicList(): Promise<RoomResponse[]> {
    const rooms = await this.roomsRepo.findPublicRooms();
    return rooms.map((room) => toRoomResponse(room));
  }

  /** Lấy chi tiết phòng công khai theo slug cho khách tham quan 3D. */
  async getPublicBySlug(slug: string): Promise<RoomResponse> {
    const room = await this.roomsRepo.findActiveBySlug(slug);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }
    return toRoomResponse(room);
  }

  /** Tạo phòng trưng bày mới, kiểm tra tính duy nhất của slug. */
  async create(dto: CreateRoomDto): Promise<RoomResponse> {
    const existing = await this.roomsRepo.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" đã được sử dụng`);
    }

    const room = this.roomsRepo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
    });

    const saved = (await this.roomsRepo.save(room)) as Room;
    return toRoomResponse(saved);
  }

  /** Cập nhật thông tin phòng (name, description, status), bất biến slug. */
  async update(id: string, dto: UpdateRoomDto): Promise<RoomResponse> {
    const room = await this.roomsRepo.findWithExhibits(id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    if (dto.name !== undefined) {
      room.name = dto.name;
    }
    if (dto.description !== undefined) {
      room.description = dto.description ?? null;
    }
    if (dto.status !== undefined) {
      room.status = dto.status;
    }

    const saved = (await this.roomsRepo.save(room)) as Room;
    return toRoomResponse(saved);
  }

  /**
   * Xóa mềm phòng trưng bày.
   * Quy tắc BR-20: Từ chối xóa nếu phòng đang chứa hiện vật liên kết.
   */
  async remove(id: string): Promise<void> {
    const room = await this.roomsRepo.findWithExhibits(id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    // BR-20: Kiểm tra nếu phòng đang chứa hiện vật (hiện vật đã xóa mềm không tính)
    const blocked = this.deletionBlock(room.exhibits?.length ?? 0);
    if (blocked) {
      throw new ConflictException(blocked);
    }

    // Thực hiện soft-delete chuẩn ràng buộc kiểm tra cơ sở dữ liệu
    room.isDeleted = true;
    room.deletedAt = new Date();
    await this.roomsRepo.save(room);
  }

  /**
   * Xóa mềm nhiều phòng: tất cả hoặc không (BR-20 cho từng phòng). Trả lại danh sách ID để audit
   * ghi từng phòng.
   */
  async removeMany(ids: string[]): Promise<{ ids: string[] }> {
    await this.tx.run(async (manager) => {
      const rooms = new Map((await this.roomsRepo.lockActiveByIds(ids, manager)).map((room) => [room.id, room]));
      const exhibitCounts = await this.roomsRepo.countLiveExhibits(ids, manager);
      const blocked = ids.flatMap((id): BlockedDeletion[] => {
        const room = rooms.get(id);
        if (!room) return [{ id, reason: 'Không tìm thấy phòng trưng bày', notFound: true }];
        const reason = this.deletionBlock(exhibitCounts.get(id) ?? 0, room.name);
        return reason ? [{ id, reason }] : [];
      });
      assertNothingBlocked(blocked, false);
      await this.roomsRepo.markDeleted(ids, manager);
    });
    return { ids };
  }

  private deletionBlock(liveExhibits: number, roomName?: string): string | null {
    if (liveExhibits === 0) return null;
    return roomName
      ? `Phòng "${roomName}" đang chứa ${liveExhibits} hiện vật. Vui lòng chuyển hoặc gỡ hiện vật trước khi xóa phòng.`
      : 'Không thể xóa phòng đang chứa hiện vật. Vui lòng chuyển hoặc gỡ hiện vật trước khi xóa phòng.';
  }
}
