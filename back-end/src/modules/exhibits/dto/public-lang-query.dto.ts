import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SUPPORTED_LOCALES, SupportedLocale } from '../../translations/constants/locales';

/** Ngôn ngữ nội dung công khai: có thì trả văn bản theo ngôn ngữ đó, thiếu bản dịch thì về tiếng Việt. */
export class PublicLangQueryDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, example: 'ko' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES, { message: 'Ngôn ngữ không được hỗ trợ' })
  lang?: SupportedLocale;
}
