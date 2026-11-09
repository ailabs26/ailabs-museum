import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicRateLimitGuard } from '../../../common/rate-limit/public-rate-limit.guard';
import { PublicLangQueryDto } from '../../exhibits/dto/public-lang-query.dto';
import { RoomsService } from '../services/rooms.service';

@ApiTags('Public museum content')
@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('public/rooms')
export class PublicRoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phòng công khai cho khách tham quan' })
  getPublicList(@Query() query: PublicLangQueryDto) {
    return this.roomsService.getPublicList(query.lang);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết phòng công khai theo slug cho khách tham quan 3D' })
  getPublicBySlug(@Param('slug') slug: string, @Query() query: PublicLangQueryDto) {
    return this.roomsService.getPublicBySlug(slug, query.lang);
  }
}
