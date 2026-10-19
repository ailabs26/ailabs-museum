import { Controller, Get, Header, Param, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ExhibitsService } from '../services/exhibits.service';
import { PublicModelsService } from '../services/public-models.service';

/**
 * Nội dung công khai cho khách tham quan. `no-cache`: trình duyệt/CDN phải hỏi lại server
 * mỗi request, nên Publish/Hide/xóa có hiệu lực ngay với request mới (BR-22, AC-51).
 */
const PUBLIC_CACHE_CONTROL = 'no-cache';

@ApiTags('Public museum content')
@Public()
@Controller('rooms')
export class ExhibitsController {
  constructor(private readonly service: ExhibitsService, private readonly models: PublicModelsService) {}

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

  @Get(':slug/exhibits/:exhibitId/model')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'GLB của hiện vật đã xuất bản; truy cập Storage qua máy chủ' })
  async getModel(@Param('slug') slug: string, @Param('exhibitId') exhibitId: string,
    @Query('version') version: string | undefined, @Res({ passthrough: true }) response: Response) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    response.once('close', abort);
    try {
      const asset = await this.models.open(slug, exhibitId, version, controller.signal);
      asset.stream.once('close', () => response.off('close', abort));
      const file = new StreamableFile(asset.stream, { type: 'model/gltf-binary', length: asset.sizeBytes });
      file.setErrorLogger(() => undefined);
      return file;
    } catch (error) { response.off('close', abort); throw error; }
  }
}
