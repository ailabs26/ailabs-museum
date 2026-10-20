import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Client gửi báo cáo nội dung sai (public, rate-limited). */
export class CreateReportDto {
  @ApiProperty({ example: 'e1111111-1111-4111-1111-111111111111' })
  @IsUUID('4')
  exhibitId!: string;

  @ApiProperty({ required: false, description: 'Phiên bản đang xem bị báo cáo' })
  @IsOptional()
  @IsUUID('4')
  reportedRevisionId?: string;

  @ApiProperty({ example: 'wrong_info', description: 'Nhóm vi phạm' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category!: string;

  @ApiProperty({ example: 'Niên đại hiện vật bị ghi sai' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung báo cáo không được để trống' })
  @MaxLength(2000)
  message!: string;
}
