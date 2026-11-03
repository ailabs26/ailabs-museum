import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Audit } from '../../audit/decorators/audit.decorator';
import { TwoFactorService } from '../services/two-factor.service';

/**
 * Admin tắt 2FA hộ người dùng mất điện thoại / mất mã khôi phục. Đặt ở auth module (không phải users) vì AuthModule
 * đã import UsersModule — đặt ngược lại sẽ tạo vòng phụ thuộc.
 */
@ApiTags('Admin · Users')
@ApiBearerAuth()
@Controller('users')
export class UserTwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Post(':id/2fa/reset')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.USER_UPDATE)
  @Audit('user.2fa_reset', 'user')
  @ApiOperation({ summary: 'Tắt 2FA của một tài khoản (xóa secret + mã khôi phục) và đăng xuất mọi thiết bị của tài khoản đó' })
  @ApiConflictResponse({ description: 'Tài khoản chưa bật 2FA.' })
  reset(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.twoFactor.adminReset(id);
  }
}
