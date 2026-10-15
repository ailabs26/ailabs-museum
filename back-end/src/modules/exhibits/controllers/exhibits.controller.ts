import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ExhibitsService } from '../services/exhibits.service';

/**
 * Nội dung công khai cho khách tham quan. `no-cache`: trình duyệt/CDN phải hỏi lại server
 * mỗi request, nên Publish/Hide/xóa có hiệu lực ngay với request mới (BR-22, AC-51).
 */
const PUBLIC_CACHE_CONTROL = 'no-cache';

@ApiTags('Public museum content')
@Public()
@Controller('rooms')
export class ExhibitsController {
  constructor(private readonly service: ExhibitsService) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  @ApiOperation({ summary: 'Danh sách phòng công khai' })
  listRooms() {
    return this.service.roomsList();
  }

  @Get(':slug')
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  @ApiOperation({ summary: 'Phòng và hiện vật công khai (revision Published hiện hành + media) theo slug' })
  getRoom(@Param('slug') slug: string) {
    return this.service.roomWithExhibits(slug);
  }
}
