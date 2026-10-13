import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BilingualDescriptionDto, BilingualNameDto } from './bilingual-text.dto';
import { CreateHotspotDto } from './hotspot.dto';
import { Scale3Dto, Vector3Dto } from './vector3.dto';

export class UpdateExhibitDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'roomId phải là định dạng UUID hợp lệ' })
  roomId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return plainToInstance(BilingualNameDto, { vi: value.trim() });
    }
    if (value && typeof value === 'object' && !(value instanceof BilingualNameDto)) {
      return plainToInstance(BilingualNameDto, value);
    }
    return value;
  })
  @ValidateNested()
  @Type(() => BilingualNameDto)
  name?: BilingualNameDto;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return plainToInstance(BilingualDescriptionDto, { vi: value.trim() });
    }
    if (value && typeof value === 'object' && !(value instanceof BilingualDescriptionDto)) {
      return plainToInstance(BilingualDescriptionDto, value);
    }
    return value;
  })
  @ValidateNested()
  @Type(() => BilingualDescriptionDto)
  description?: BilingualDescriptionDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị displayOrder phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị displayOrder không được âm' })
  displayOrder?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Vector3Dto)
  position?: Vector3Dto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'positionX phải là số hữu hạn' })
  positionX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'positionY phải là số hữu hạn' })
  positionY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'positionZ phải là số hữu hạn' })
  positionZ?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Vector3Dto)
  rotation?: Vector3Dto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'rotationX phải là số hữu hạn' })
  rotationX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'rotationY phải là số hữu hạn' })
  rotationY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'rotationZ phải là số hữu hạn' })
  rotationZ?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Scale3Dto)
  scale?: Scale3Dto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'scaleX phải là số hữu hạn' })
  @IsPositive({ message: 'scaleX phải lớn hơn 0' })
  scaleX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'scaleY phải là số hữu hạn' })
  @IsPositive({ message: 'scaleY phải lớn hơn 0' })
  scaleY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'scaleZ phải là số hữu hạn' })
  @IsPositive({ message: 'scaleZ phải lớn hơn 0' })
  scaleZ?: number;

  @IsOptional()
  @IsString({ message: 'placeholderShape phải là chuỗi' })
  @IsIn(['box', 'sphere', 'cylinder', 'cone', 'torus'], {
    message: 'placeholderShape phải là: box, sphere, cylinder, cone, hoặc torus',
  })
  placeholderShape?: string;

  @IsOptional()
  @IsString({ message: 'placeholderColor phải là chuỗi' })
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'placeholderColor phải là mã hex 6 ký tự hợp lệ (ví dụ: #8b7355)',
  })
  placeholderColor?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'modelId phải là UUID hợp lệ' })
  modelId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: 'imageId phải là UUID hợp lệ' })
  imageId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: 'audioId phải là UUID hợp lệ' })
  audioId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return plainToInstance(BilingualDescriptionDto, { vi: value.trim() });
    }
    if (value && typeof value === 'object' && !(value instanceof BilingualDescriptionDto)) {
      return plainToInstance(BilingualDescriptionDto, value);
    }
    return value;
  })
  @ValidateNested()
  @Type(() => BilingualDescriptionDto)
  transcript?: BilingualDescriptionDto | null;

  @IsOptional()
  @IsString({ message: 'transcriptPlain phải là chuỗi' })
  @MaxLength(20000, { message: 'transcript tối đa 20.000 ký tự' })
  transcriptPlain?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return plainToInstance(BilingualNameDto, { vi: value.trim() });
    }
    if (value && typeof value === 'object' && !(value instanceof BilingualNameDto)) {
      return plainToInstance(BilingualNameDto, value);
    }
    return value;
  })
  @ValidateNested()
  @Type(() => BilingualNameDto)
  altText?: BilingualNameDto | null;

  @IsOptional()
  @IsString({ message: 'altTextPlain phải là chuỗi' })
  @MaxLength(240, { message: 'altText tối đa 240 ký tự' })
  altTextPlain?: string | null;

  @IsOptional()
  @IsArray({ message: 'hotspots phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateHotspotDto)
  hotspots?: CreateHotspotDto[];
}

