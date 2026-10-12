import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/** Đánh dấu route công khai — JwtAuthGuard (PR #D) sẽ bỏ qua xác thực. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
