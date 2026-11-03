import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserStatus } from '../entities/user.entity';
import { IsStrongPassword } from '../../../common/security/password-policy';

export class UpdateUserDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(UserStatus, { message: 'Trạng thái phải là active hoặc disabled' })
  status?: UserStatus;

  /** Đặt lại mật khẩu (tùy chọn). */
  @ValidateIf((_object, value) => value !== undefined)
  /** Chính sách độ mạnh; việc không chứa email/tên của user được kiểm ở UsersService. */
  @IsString()
  @IsStrongPassword()
  password?: string;

  /** Khi có trường này, thay toàn bộ vai trò trong cùng transaction cập nhật. */
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
