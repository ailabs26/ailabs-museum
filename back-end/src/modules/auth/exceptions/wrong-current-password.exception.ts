import { BadRequestException } from '@nestjs/common';

/**
 * Sai mật khẩu hiện tại khi tự đổi mật khẩu. Cố ý dùng 400 (không phải 401): frontend coi 401
 * là phiên hết hạn và sẽ đăng xuất người dùng. Lỗi gắn với field để hiện ngay dưới ô nhập.
 */
export class WrongCurrentPasswordException extends BadRequestException {
  constructor() {
    super({
      message: 'Mật khẩu hiện tại không đúng',
      errors: [{ code: 'wrong_current_password', field: 'currentPassword', message: 'Mật khẩu hiện tại không đúng' }],
    });
  }
}
