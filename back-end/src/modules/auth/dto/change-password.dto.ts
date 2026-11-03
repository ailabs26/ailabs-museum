import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/security/password-policy';

export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true, format: 'password' })
  @IsString()
  @MinLength(1, { message: 'Nhập mật khẩu hiện tại' })
  @MaxLength(128)
  currentPassword!: string;

  /** Cùng chính sách với mật khẩu khi Admin tạo tài khoản; việc không chứa email/tên được kiểm ở AuthService. */
  @ApiProperty({ minLength: 10, maxLength: 72, writeOnly: true, format: 'password' })
  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
