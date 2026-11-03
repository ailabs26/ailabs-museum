import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BulkIdsDto } from '../../../common/dto/bulk-ids.dto';
import { CreateRoomDto } from '../dto/create-room.dto';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { RoomsService } from '../services/rooms.service';

@ApiTags('Admin · Rooms')
@ApiBearerAuth()
@Controller('admin/rooms')
export class AdminRoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @Permissions(PERMISSIONS.ROOM_READ)
  @ApiOperation({ summary: 'Danh sách phòng trưng bày (phân trang, lọc, tìm kiếm; deleted=true → thùng rác)' })
  list(@Query() query: ListRoomsQueryDto) {
    return this.roomsService.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROOM_READ)
  @ApiOperation({ summary: 'Chi tiết phòng trưng bày theo UUID' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.getById(id);
  }

  @Post()
  @Permissions(PERMISSIONS.ROOM_CREATE)
  @Audit('room.create', 'room')
  @ApiOperation({ summary: 'Tạo phòng trưng bày mới' })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROOM_UPDATE)
  @Audit('room.update', 'room')
  @ApiOperation({ summary: 'Cập nhật phòng trưng bày (bất biến slug)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(id, dto);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.ROOM_DELETE)
  @Audit('room.delete', 'room')
  @ApiOperation({ summary: 'Xóa mềm nhiều phòng (tất cả hoặc không; BR-20, 409 kèm lý do từng ID)' })
  removeMany(@Body() dto: BulkIdsDto) {
    return this.roomsService.removeMany(dto.ids);
  }

  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.ROOM_DELETE)
  @Audit('room.restore', 'room')
  @ApiOperation({ summary: 'Khôi phục phòng đã xóa mềm (tất cả hoặc không; 409 kèm lý do từng ID)' })
  restoreMany(@Body() dto: BulkIdsDto) {
    return this.roomsService.restoreMany(dto.ids);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROOM_DELETE)
  @Audit('room.delete', 'room')
  @ApiOperation({ summary: 'Xóa mềm phòng trưng bày (quy tắc BR-20)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.remove(id);
  }
}
