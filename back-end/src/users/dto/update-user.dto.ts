import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserStatus } from '../user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsEnum(UserStatus, { message: 'Trạng thái phải là active hoặc disabled' })
  status?: UserStatus;

  /** Đặt lại mật khẩu (tùy chọn). */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128)
  password?: string;
}
