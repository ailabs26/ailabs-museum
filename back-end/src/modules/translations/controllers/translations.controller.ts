import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreateTranslationDto } from '../dto/create-translation.dto';
import { UpdateTranslationValuesDto } from '../dto/update-translation-values.dto';
import { TranslationsService } from '../services/translations.service';

@ApiTags('Admin · Translations')
@ApiBearerAuth()
@Controller('translations')
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Get()
  @Permissions(PERMISSIONS.TRANSLATION_READ)
  @ApiOperation({ summary: 'Danh sách chuỗi dịch đa ngôn ngữ' })
  list() {
    return this.translations.list();
  }

  @Post()
  @Permissions(PERMISSIONS.TRANSLATION_MANAGE)
  @Audit('translation.create', 'translation')
  @ApiOperation({ summary: 'Thêm chuỗi dịch' })
  create(@Body() dto: CreateTranslationDto) {
    return this.translations.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.TRANSLATION_MANAGE)
  @Audit('translation.update', 'translation')
  @ApiOperation({ summary: 'Cập nhật bản dịch của một chuỗi' })
  updateValues(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTranslationValuesDto) {
    return this.translations.updateValues(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.TRANSLATION_MANAGE)
  @Audit('translation.delete', 'translation')
  @ApiOperation({ summary: 'Xóa chuỗi dịch' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.translations.remove(id);
  }
}
