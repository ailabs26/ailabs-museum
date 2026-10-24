import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export enum PublicReportCategory {
  WRONG_INFO = 'wrong_info',
  TYPO = 'typo',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  OTHER = 'other',
}

/** Client gửi báo cáo nội dung sai (public, rate-limited). */
export class CreateReportDto {
  @ApiProperty({ example: 'e1111111-1111-4111-1111-111111111111' })
  @IsUUID('4')
  exhibitId!: string;

  @ApiProperty({ required: false, description: 'Phiên bản đang xem bị báo cáo' })
  @IsOptional()
  @IsUUID('4')
  reportedRevisionId?: string;

  @ApiProperty({ enum: PublicReportCategory, description: 'Danh mục báo cáo cố định' })
  @IsEnum(PublicReportCategory)
  category!: PublicReportCategory;

  @ApiProperty({ example: 'Niên đại hiện vật bị ghi sai' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung báo cáo không được để trống' })
  @Matches(/\S/, { message: 'Nội dung báo cáo không được để trống' })
  @MaxLength(2000)
  message!: string;
}
