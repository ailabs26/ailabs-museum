import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength, ValidateIf,
} from 'class-validator';
import { API_SCOPES } from '../constants/scopes';

export class CreatePartnerApiKeyDto {
  @ApiProperty({ example: 'VietnamPlus' })
  @IsString()
  @MaxLength(120)
  partnerName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @ApiProperty({ enum: API_SCOPES, isArray: true })
  @IsArray()
  @ArrayNotEmpty({ message: 'Chọn ít nhất một phạm vi' })
  @ArrayUnique()
  @IsIn(API_SCOPES, { each: true, message: 'Phạm vi không hợp lệ' })
  scopes!: string[];

  /** Số ngày hiệu lực; null = không hết hạn. */
  @ApiProperty({ required: false, nullable: true, minimum: 1, maximum: 3650 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number | null;
}
