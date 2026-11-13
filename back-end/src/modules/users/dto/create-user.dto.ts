import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsStrongPassword } from '../../../common/security/password-policy';

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  /** Chính sách độ mạnh (common/security/password-policy), gồm cả việc không chứa email/tên ở chính DTO này. */
  @IsString()
  @IsStrongPassword()
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  displayName!: string;

  /** Danh sách roleId gán khi tạo (tùy chọn). */
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
