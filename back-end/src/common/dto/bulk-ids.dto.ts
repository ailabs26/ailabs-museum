import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** Danh sách ID cho thao tác hàng loạt (vd xóa các dòng đã chọn trên một trang quản trị). */
export class BulkIdsDto {
  @ApiProperty({ type: [String], format: 'uuid', minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayNotEmpty({ message: 'Chưa chọn mục nào' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 mục mỗi lần' })
  @ArrayUnique({ message: 'Danh sách có ID trùng' })
  @IsUUID('all', { each: true, message: 'ID không hợp lệ' })
  ids!: string[];
}
