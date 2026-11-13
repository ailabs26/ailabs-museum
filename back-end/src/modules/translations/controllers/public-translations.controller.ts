import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicRateLimitGuard } from '../../../common/rate-limit/public-rate-limit.guard';
import { PublicTranslationsQueryDto } from '../dto/public-translations-query.dto';
import { TranslationsService } from '../services/translations.service';

@ApiTags('Public · Translations')
@UseGuards(PublicRateLimitGuard)
@Controller('public/translations')
export class PublicTranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Chuỗi giao diện công khai của một ngôn ngữ: { namespace: text }, chỉ loại ui' })
  list(@Query() query: PublicTranslationsQueryDto) {
    return this.translations.publicUi(query.locale);
  }
}
