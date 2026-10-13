import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderExhibitsDto {
  @ApiProperty({
    description: 'Danh sách UUID của các hiện vật theo thứ tự hiển thị mới',
    example: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001'],
    type: [String],
  })
  @IsArray({ message: 'exhibitIds phải là một mảng các UUID' })
  @ArrayNotEmpty({ message: 'exhibitIds không được để trống' })
  @IsUUID('all', { each: true, message: 'Mỗi exhibitId phải là định dạng UUID hợp lệ' })
  exhibitIds!: string[];
}

