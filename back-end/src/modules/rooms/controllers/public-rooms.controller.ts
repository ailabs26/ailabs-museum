import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { RoomsService } from '../services/rooms.service';

@ApiTags('Public museum content')
@Public()
@Controller('public/rooms')
export class PublicRoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phòng công khai cho khách tham quan' })
  getPublicList() {
    return this.roomsService.getPublicList();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết phòng công khai theo slug cho khách tham quan 3D' })
  getPublicBySlug(@Param('slug') slug: string) {
    return this.roomsService.getPublicBySlug(slug);
  }
}
