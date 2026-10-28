import { Controller, Get, Header, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { ExhibitsService } from '../../exhibits/services/exhibits.service';
import { PublicModelsService } from '../../exhibits/services/public-models.service';
import { PartnerScope } from '../decorators/partner-scopes.decorator';
import { PartnerApiKeyGuard } from '../guards/partner-api-key.guard';

/**
 * Cổng API cho đối tác: cùng nội dung công khai (chỉ revision Published hiện hành) nhưng bắt buộc
 * API key, kiểm scope và giới hạn request theo từng key. `@Public()` để guard JWT của admin bỏ qua;
 * `PartnerApiKeyGuard` mới là chốt chặn.
 */
@ApiTags('Partner API v1')
@ApiHeader({ name: 'X-API-Key', required: true, description: 'Khóa API do Admin cấp (ak_live_…)' })
@Public()
@UseGuards(PartnerApiKeyGuard)
@Controller('partner/v1')
export class PartnerApiController {
  constructor(private readonly exhibits: ExhibitsService, private readonly models: PublicModelsService) {}

  @Get('rooms')
  @PartnerScope('rooms:read')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Danh sách phòng công khai' })
  listRooms() {
    return this.exhibits.roomsList();
  }

  @Get('rooms/:slug')
  @PartnerScope('exhibits:read')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Phòng và hiện vật đã xuất bản (kèm URL media công khai)' })
  getRoom(@Param('slug') slug: string) {
    return this.exhibits.roomWithExhibits(slug);
  }

  @Get('rooms/:slug/tour')
  @PartnerScope('tour:embed')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Thứ tự tham quan của phòng để nhúng tour (gọn, theo displayOrder)' })
  async getTour(@Param('slug') slug: string) {
    const room = await this.exhibits.roomWithExhibits(slug);
    return {
      room: { id: room.id, slug: room.slug, name: room.name },
      stops: [...room.exhibits]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((exhibit) => ({ exhibitId: exhibit.id, displayOrder: exhibit.displayOrder, name: exhibit.name, i18n: exhibit.i18n })),
    };
  }

  @Get('rooms/:slug/exhibits/:exhibitId/model')
  @PartnerScope('media:read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Tệp GLB của hiện vật đã xuất bản' })
  async getModel(@Param('slug') slug: string, @Param('exhibitId') exhibitId: string,
    @Query('version') version: string | undefined, @Res({ passthrough: true }) response: Response) {
    // Cùng cách stream với ExhibitsController: hủy đọc Storage khi đối tác ngắt kết nối.
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
