import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true, format: 'password' })
  @IsString()
  @MinLength(1, { message: 'Nhập mật khẩu hiện tại' })
  @MaxLength(128)
  currentPassword!: string;

  /** Cùng quy tắc với mật khẩu khi Admin tạo tài khoản (CreateUserDto). */
  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true, format: 'password' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128)
  newPassword!: string;
}
