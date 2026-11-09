import { Controller, Get, Header, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ExhibitsService } from '../services/exhibits.service';

/** Sitemap cho công cụ tìm kiếm; URL trỏ về trang khách (`FRONTEND_ORIGIN`). */
@ApiTags('Public museum content')
@Public()
@Controller('public')
export class PublicSitemapController {
  constructor(private readonly service: ExhibitsService, private readonly config: ConfigService) {}

  @Get('sitemap.xml')
  // Công cụ tìm kiếm không cần thấy thay đổi tức thì; giảm tải truy vấn khi bị quét liên tục.
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiProduces('application/xml')
  @ApiOperation({ summary: 'Sitemap các trang khách: trang chính, phòng active, hiện vật đã xuất bản' })
  async sitemap(): Promise<StreamableFile> {
    const xml = await this.service.sitemapXml(this.config.getOrThrow<string>('app.frontendOrigin'));
    // StreamableFile để ResponseInterceptor không bọc XML thành JSON.
    return new StreamableFile(Buffer.from(xml, 'utf8'), { type: 'application/xml; charset=utf-8' });
  }
}
