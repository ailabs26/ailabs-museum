import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { LOCALE_LABELS, SupportedLocale } from '../../translations/constants/locales';

/** Bản dịch không bắt buộc của một ngôn ngữ, cùng giới hạn độ dài với tiếng Việt và tiếng Anh. */
function OptionalTranslation(subject: string, locale: SupportedLocale, max: number) {
  const label = `${subject} ${LOCALE_LABELS[locale].toLowerCase()}`;
  return applyDecorators(
    IsOptional(),
    IsString({ message: `${label} phải là chuỗi ký tự` }),
    MaxLength(max, { message: `${label} không được vượt quá ${max.toLocaleString('vi-VN')} ký tự` }),
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
  );
}

/**
 * DTO cho văn bản đa ngôn ngữ (tiếng Việt, tiếng Anh và các bản dịch không bắt buộc)
 */
export class BilingualTextDto {
  @IsOptional()
  @IsString({ message: 'Nội dung tiếng Việt phải là chuỗi ký tự' })
  @MaxLength(10000, { message: 'Nội dung tiếng Việt không được vượt quá 10.000 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  vi?: string;

  @IsOptional()
  @IsString({ message: 'Nội dung tiếng Anh phải là chuỗi ký tự' })
  @MaxLength(10000, { message: 'Nội dung tiếng Anh không được vượt quá 10.000 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  en?: string;

  @OptionalTranslation('Nội dung', 'fr', 10000)
  fr?: string;

  @OptionalTranslation('Nội dung', 'zh', 10000)
  zh?: string;

  @OptionalTranslation('Nội dung', 'ko', 10000)
  ko?: string;

  @OptionalTranslation('Nội dung', 'ja', 10000)
  ja?: string;
}

/**
 * DTO cho tên/tiêu đề đa ngôn ngữ (giới hạn 200 ký tự)
 */
export class BilingualNameDto {
  @IsOptional()
  @IsString({ message: 'Tên tiếng Việt phải là chuỗi ký tự' })
  @MaxLength(200, { message: 'Tên tiếng Việt không được vượt quá 200 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  vi?: string;

  @IsOptional()
  @IsString({ message: 'Tên tiếng Anh phải là chuỗi ký tự' })
  @MaxLength(200, { message: 'Tên tiếng Anh không được vượt quá 200 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  en?: string;

  @OptionalTranslation('Tên', 'fr', 200)
  fr?: string;

  @OptionalTranslation('Tên', 'zh', 200)
  zh?: string;

  @OptionalTranslation('Tên', 'ko', 200)
  ko?: string;

  @OptionalTranslation('Tên', 'ja', 200)
  ja?: string;
}

/**
 * DTO cho mô tả đa ngôn ngữ (giới hạn 10.000 ký tự)
 */
export class BilingualDescriptionDto {
  @IsOptional()
  @IsString({ message: 'Mô tả tiếng Việt phải là chuỗi ký tự' })
  @MaxLength(10000, { message: 'Mô tả tiếng Việt không được vượt quá 10.000 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  vi?: string;

  @IsOptional()
  @IsString({ message: 'Mô tả tiếng Anh phải là chuỗi ký tự' })
  @MaxLength(10000, { message: 'Mô tả tiếng Anh không được vượt quá 10.000 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  en?: string;

  @OptionalTranslation('Mô tả', 'fr', 10000)
  fr?: string;

  @OptionalTranslation('Mô tả', 'zh', 10000)
  zh?: string;

  @OptionalTranslation('Mô tả', 'ko', 10000)
  ko?: string;

  @OptionalTranslation('Mô tả', 'ja', 10000)
  ja?: string;
}

