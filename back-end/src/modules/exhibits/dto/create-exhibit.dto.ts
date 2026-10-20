import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
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

export class CreateExhibitDto {
  @IsUUID(undefined, { message: 'roomId phải là định dạng UUID hợp lệ' })
  @IsNotEmpty({ message: 'roomId không được để trống' })
  roomId!: string;

  /**
   * Tên hiện vật song ngữ hoặc chuỗi đơn.
   * Khi Save Draft: được phép để trống/chưa hoàn thiện.
   * Tự động wrap string sang { vi: string } nếu truyền chuỗi.
   */
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

  /**
   * Mô tả hiện vật song ngữ hoặc chuỗi đơn.
   * Khi Save Draft: được phép để trống.
   */
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
  displayOrder?: number = 0;

  /**
   * Vị trí 3D (Position) — đơn vị mét, Y hướng lên
   */
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

  /**
   * Góc xoay 3D (Rotation) — đơn vị radian, Euler XYZ
   */
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

  /**
   * Tỉ lệ 3D (Scale) — từng trục phải > 0
   */
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

  /**
   * Hình dạng khối placeholder khi chưa có model 3D
   */
  @IsOptional()
  @IsString({ message: 'placeholderShape phải là chuỗi' })
  @IsIn(['box', 'sphere', 'cylinder', 'cone', 'torus'], {
    message: 'placeholderShape phải là: box, sphere, cylinder, cone, hoặc torus',
  })
  placeholderShape?: string = 'box';

  /**
   * Màu hex của khối placeholder
   */
  @IsOptional()
  @IsString({ message: 'placeholderColor phải là chuỗi' })
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'placeholderColor phải là mã hex 6 ký tự hợp lệ (ví dụ: #8b7355)',
  })
  placeholderColor?: string = '#8b7355';

  /**
   * Khóa ngoại đến Media
   */
  @IsOptional()
  @IsUUID(undefined, { message: 'modelId phải là UUID hợp lệ' })
  modelId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: 'imageId phải là UUID hợp lệ' })
  imageId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: 'audioId phải là UUID hợp lệ' })
  audioId?: string | null;

  /**
   * Văn bản transcript thuyết minh (tối đa 20.000 ký tự theo SRS 5.2)
   */
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
  transcript?: BilingualDescriptionDto;

  @IsOptional()
  @IsString({ message: 'transcriptPlain phải là chuỗi' })
  @MaxLength(20000, { message: 'transcript tối đa 20.000 ký tự' })
  transcriptPlain?: string;

  /**
   * Alt-text cho ảnh (tối đa 240 ký tự)
   */
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
  altText?: BilingualNameDto;

  @IsOptional()
  @IsString({ message: 'altTextPlain phải là chuỗi' })
  @MaxLength(240, { message: 'altText tối đa 240 ký tự' })
  altTextPlain?: string;

  /**
   * Danh sách Hotspots gắn trên hiện vật
   */
  @IsOptional()
  @IsArray({ message: 'hotspots phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateHotspotDto)
  hotspots?: CreateHotspotDto[];

  /**
   * Helper trích xuất Position chuẩn
   */
  getResolvedPosition(): { x: number; y: number; z: number } {
    return {
      x: this.position?.x ?? this.positionX ?? 0,
      y: this.position?.y ?? this.positionY ?? 0,
      z: this.position?.z ?? this.positionZ ?? 0,
    };
  }

  /**
   * Helper trích xuất Rotation chuẩn
   */
  getResolvedRotation(): { x: number; y: number; z: number } {
    return {
      x: this.rotation?.x ?? this.rotationX ?? 0,
      y: this.rotation?.y ?? this.rotationY ?? 0,
      z: this.rotation?.z ?? this.rotationZ ?? 0,
    };
  }

  /**
   * Helper trích xuất Scale chuẩn
   */
  getResolvedScale(): { x: number; y: number; z: number } {
    return {
      x: this.scale?.x ?? this.scaleX ?? 1,
      y: this.scale?.y ?? this.scaleY ?? 1,
      z: this.scale?.z ?? this.scaleZ ?? 1,
    };
  }
}

