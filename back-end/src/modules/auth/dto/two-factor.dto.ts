import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const stripSpaces = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value);
const SIX_DIGITS = /^\d{6}$/;
const SIX_DIGITS_MESSAGE = 'Mã xác thực gồm 6 chữ số';

/** Mã 6 số từ app Authenticator. */
export class TwoFactorCodeDto {
  @ApiProperty({ example: '123456' })
  @Transform(stripSpaces)
  @IsString()
  @Matches(SIX_DIGITS, { message: SIX_DIGITS_MESSAGE })
  code!: string;
}

/** Bước 2 đăng nhập: token tạm từ bước 1 + mã TOTP hoặc mã khôi phục. */
export class LoginTwoFactorDto {
  @ApiProperty({ description: '`mfaToken` nhận được từ POST /auth/login' })
  @IsString()
  @MaxLength(2000)
  mfaToken!: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @Transform(stripSpaces)
  @IsString()
  @Matches(SIX_DIGITS, { message: SIX_DIGITS_MESSAGE })
  code?: string;

  @ApiPropertyOptional({ example: 'abcde-fghij', description: 'Mã khôi phục dùng một lần (thay cho mã 6 số)' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  recoveryCode?: string;
}

/** Tắt 2FA: mật khẩu hiện tại + mã TOTP hoặc mã khôi phục. */
export class DisableTwoFactorDto {
  @ApiProperty({ writeOnly: true, format: 'password' })
  @IsString()
  @MinLength(1, { message: 'Nhập mật khẩu hiện tại' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @Transform(stripSpaces)
  @IsString()
  @Matches(SIX_DIGITS, { message: SIX_DIGITS_MESSAGE })
  code?: string;

  @ApiPropertyOptional({ example: 'abcde-fghij' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  recoveryCode?: string;
}
