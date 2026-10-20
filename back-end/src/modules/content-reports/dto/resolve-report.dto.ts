import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Kết luận khi xử lý hoặc đóng báo cáo. */
export class ResolveReportDto {
  @ApiProperty({ example: 'Đã sửa thông tin niên đại và xuất bản lại' })
  @IsString()
  @IsNotEmpty({ message: 'Phải nêu kết luận xử lý' })
  @MaxLength(1000)
  resolution!: string;
}
