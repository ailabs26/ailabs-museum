import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TRANSLATION_CATEGORIES, type TranslationCategory } from '../entities/translation.entity';

export class CreateTranslationDto {
  /** Khóa định danh ổn định, vd 'exhibit.ten-hien-vat.name'. */
  @ApiProperty({ example: 'exhibit.trong-dong.name' })
  @IsString()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, {
    message: 'Namespace dạng khóa: chữ thường/số, phân tách bằng dấu chấm hoặc gạch ngang',
  })
  namespace!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  context?: string;

  @ApiProperty({ enum: TRANSLATION_CATEGORIES })
  @IsIn(TRANSLATION_CATEGORIES)
  category!: TranslationCategory;

  /** Bản dịch ban đầu theo mã ngôn ngữ, ví dụ `{ "vi": "..." }`. */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  @IsObject()
  values!: Record<string, string>;
}
