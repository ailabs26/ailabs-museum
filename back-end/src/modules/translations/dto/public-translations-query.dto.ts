import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../constants/locales';

export class PublicTranslationsQueryDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'en' })
  @IsIn(SUPPORTED_LOCALES, { message: 'Ngôn ngữ không được hỗ trợ' })
  locale!: SupportedLocale;
}
