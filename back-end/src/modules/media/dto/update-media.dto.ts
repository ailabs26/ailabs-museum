import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimToNull } from './trim-to-null.transform';

export const MEDIA_TEXT_LIMITS = {
  altText: 240,
  source: 500,
  author: 200,
  license: 1000,
} as const;

/**
 * Metadata mô tả & quyền sử dụng (FR-97). Không có trường `url`/`storageKey`: file chỉ
 * vào hệ thống qua pipeline upload, ValidationPipe (forbidNonWhitelisted) từ chối trường lạ.
 * `undefined` = giữ nguyên, `null` hoặc chuỗi rỗng = xóa giá trị.
 */
export class UpdateMediaDto {
  @ApiPropertyOptional({ maxLength: MEDIA_TEXT_LIMITS.altText, nullable: true, description: 'Văn bản thay thế cho hình ảnh' })
  @IsOptional()
  @TrimToNull()
  @IsString({ message: 'altText phải là chuỗi' })
  @MaxLength(MEDIA_TEXT_LIMITS.altText, { message: `altText không được vượt quá ${MEDIA_TEXT_LIMITS.altText} ký tự` })
  altText?: string | null;

  @ApiPropertyOptional({ maxLength: MEDIA_TEXT_LIMITS.source, nullable: true, description: 'Nguồn gốc tư liệu' })
  @IsOptional()
  @TrimToNull()
  @IsString({ message: 'source phải là chuỗi' })
  @MaxLength(MEDIA_TEXT_LIMITS.source, { message: `source không được vượt quá ${MEDIA_TEXT_LIMITS.source} ký tự` })
  source?: string | null;

  @ApiPropertyOptional({ maxLength: MEDIA_TEXT_LIMITS.author, nullable: true, description: 'Tác giả / chủ sở hữu' })
  @IsOptional()
  @TrimToNull()
  @IsString({ message: 'author phải là chuỗi' })
  @MaxLength(MEDIA_TEXT_LIMITS.author, { message: `author không được vượt quá ${MEDIA_TEXT_LIMITS.author} ký tự` })
  author?: string | null;

  @ApiPropertyOptional({ maxLength: MEDIA_TEXT_LIMITS.license, nullable: true, description: 'Giấy phép sử dụng' })
  @IsOptional()
  @TrimToNull()
  @IsString({ message: 'license phải là chuỗi' })
  @MaxLength(MEDIA_TEXT_LIMITS.license, { message: `license không được vượt quá ${MEDIA_TEXT_LIMITS.license} ký tự` })
  license?: string | null;
}
