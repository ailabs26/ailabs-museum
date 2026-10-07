import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExhibitsService } from './exhibits.service';

@ApiTags('Public museum content')
@Controller('rooms')
export class ExhibitsController {
  constructor(private readonly service: ExhibitsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phòng công khai' })
  listRooms() { return this.service.roomsList(); }

  @Get(':slug')
  @ApiOperation({ summary: 'Phòng và hiện vật công khai theo slug' })
  getRoom(@Param('slug') slug: string) { return this.service.roomWithExhibits(slug); }
}
