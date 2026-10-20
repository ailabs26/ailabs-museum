import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO cho văn bản song ngữ (Tiếng Việt và Tiếng Anh)
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
}

/**
 * DTO cho tên/tiêu đề song ngữ (giới hạn 200 ký tự)
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
}

/**
 * DTO cho mô tả song ngữ (giới hạn 10.000 ký tự)
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
}

