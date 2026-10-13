import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

/**
 * Tọa độ 3D (Position hoặc Rotation trong Three.js).
 * Các giá trị phải là số thực hữu hạn (finite number).
 */
export class Vector3Dto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tọa độ x phải là một số hữu hạn' })
  x: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tọa độ y phải là một số hữu hạn' })
  y: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tọa độ z phải là một số hữu hạn' })
  z: number = 0;
}

/**
 * Tỉ lệ 3D (Scale trong Three.js).
 * SRS 5.2 quy định: Scale từng trục phải là số hữu hạn và > 0.
 */
export class Scale3Dto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỉ lệ scale x phải là một số hữu hạn' })
  @IsPositive({ message: 'Tỉ lệ scale x phải lớn hơn 0' })
  x: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỉ lệ scale y phải là một số hữu hạn' })
  @IsPositive({ message: 'Tỉ lệ scale y phải lớn hơn 0' })
  y: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỉ lệ scale z phải là một số hữu hạn' })
  @IsPositive({ message: 'Tỉ lệ scale z phải lớn hơn 0' })
  z: number = 1;
}

