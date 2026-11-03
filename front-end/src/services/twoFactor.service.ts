import { http } from '@/core/api/http-client';
import type { TwoFactorCode } from '@/core/auth/types';

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetup {
  otpauthUrl: string;
  /** Ảnh QR (data URL PNG) cho app Authenticator. */
  qrDataUrl: string;
  /** Secret base32 để nhập tay khi không quét được QR. */
  secret: string;
}

/** Xác thực 2 lớp (TOTP) của chính người dùng; Admin tắt hộ qua `resetForUser`. */
export const twoFactorService = {
  status(): Promise<TwoFactorStatus> {
    return http.get<TwoFactorStatus>('/auth/2fa');
  },
  setup(): Promise<TwoFactorSetup> {
    return http.post<TwoFactorSetup>('/auth/2fa/setup');
  },
  enable(code: string): Promise<{ recoveryCodes: string[] }> {
    return http.post<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code });
  },
  disable(password: string, code: TwoFactorCode): Promise<void> {
    return http.post<void>('/auth/2fa/disable', { password, ...code });
  },
  regenerateRecoveryCodes(code: string): Promise<{ recoveryCodes: string[] }> {
    return http.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { code });
  },
  resetForUser(userId: string): Promise<void> {
    return http.post<void>(`/users/${userId}/2fa/reset`);
  },
};
