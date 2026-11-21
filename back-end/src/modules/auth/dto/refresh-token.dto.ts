import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body tùy chọn của /auth/refresh và /auth/logout.
 * Chỉ client native (header `X-Client: mobile`) dùng; trình duyệt vẫn dùng cookie HttpOnly và bỏ qua field này.
 */
export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token cho client native (`X-Client: mobile`); trình duyệt dùng cookie.',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  refreshToken?: string;
}
