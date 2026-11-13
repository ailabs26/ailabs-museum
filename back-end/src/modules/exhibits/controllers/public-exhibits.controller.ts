import { Controller, Get, Header, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicRateLimitGuard } from '../../../common/rate-limit/public-rate-limit.guard';
import { ExhibitsService } from '../services/exhibits.service';

/** Tra cứu công khai theo id hiện vật, phục vụ liên kết cố định in trên mã QR. */
@ApiTags('Public museum content')
@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('public/exhibits')
export class PublicExhibitsController {
  constructor(private readonly service: ExhibitsService) {}

  @Get(':id/location')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Phòng chứa hiện vật đã xuất bản (cho liên kết /e/<id> của mã QR); không công khai thì 404' })
  location(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.publicLocation(id);
  }
}
