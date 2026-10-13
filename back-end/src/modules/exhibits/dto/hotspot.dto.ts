import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BilingualDescriptionDto, BilingualNameDto } from './bilingual-text.dto';

/**
 * DTO cho điểm tương tác (Hotspot) trên hiện vật 3D
 */
export class CreateHotspotDto {
  @IsOptional()
  @IsUUID('4', { message: 'id của hotspot nếu cung cấp phải là UUID v4' })
  id?: string;

  /** Tiêu đề song ngữ hoặc chuỗi đơn */
  @IsOptional()
  @ValidateNested()
  @Type(() => BilingualNameDto)
  label?: BilingualNameDto;

  /** Nội dung mô tả song ngữ */
  @IsOptional()
  @ValidateNested()
  @Type(() => BilingualDescriptionDto)
  body?: BilingualDescriptionDto;

  /** Hỗ trợ truyền label phẳng (string đơn) nếu không dùng song ngữ */
  @IsOptional()
  @IsString({ message: 'Tiêu đề hotspot phải là chuỗi' })
  @MaxLength(200, { message: 'Tiêu đề hotspot tối đa 200 ký tự' })
  labelPlain?: string;

  /** Hỗ trợ truyền body phẳng (string đơn) nếu không dùng song ngữ */
  @IsOptional()
  @IsString({ message: 'Nội dung hotspot phải là chuỗi' })
  @MaxLength(5000, { message: 'Nội dung hotspot tối đa 5.000 ký tự' })
  bodyPlain?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tọa độ positionX phải là số hữu hạn' })
  positionX: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tọa độ positionY phải là số hữu hạn' })
  positionY: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tọa độ positionZ phải là số hữu hạn' })
  positionZ: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị displayOrder phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị displayOrder không được âm' })
  displayOrder: number = 0;
}

