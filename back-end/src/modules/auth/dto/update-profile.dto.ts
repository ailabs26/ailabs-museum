import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Người dùng tự sửa hồ sơ: chỉ tên hiển thị (cùng quy tắc UpdateUserDto). Email/vai trò/trạng thái do Admin quản lý. */
export class UpdateProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 160, example: 'Nguyễn Văn A' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1, { message: 'Tên hiển thị không được để trống' })
  @MaxLength(160, { message: 'Tên hiển thị tối đa 160 ký tự' })
  displayName!: string;
}
