import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { endsSession, toApiException } from '@/core/api/api-error';
import { http } from '@/core/api/http-client';
import { SESSION_QUERY_KEY } from '@/core/query/query-client';
import { authApi } from './auth-api';
import type { AuthUser, LoginPayload, LoginResult, TwoFactorCode } from './auth-schema';
import { tokenStore } from './token-store';

/**
 * - `restoring`: đang đọc phiên đã lưu lúc mở app.
 * - `unverified`: có phiên đã lưu nhưng chưa xác minh được (mất mạng, 5xx) — giữ phiên, cho thử lại.
 */
export type AuthStatus = 'restoring' | 'signedIn' | 'signedOut' | 'unverified';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Lý do chưa khôi phục được phiên (khi `unverified`). */
  restoreError: string | null;
  retryRestore: () => Promise<void>;
  /** Đăng nhập; tài khoản bật 2FA thì trả `mfaToken` để gọi tiếp `completeTwoFactor`, ngược lại null. */
  login: (payload: LoginPayload) => Promise<{ mfaToken: string } | null>;
  completeTwoFactor: (mfaToken: string, code: TwoFactorCode) => Promise<void>;
  /** Đăng xuất: xóa token cục bộ ngay (kể cả khi offline), rồi thu hồi phiên trên server nếu được. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Phiên đăng nhập của app (MOB-E3-03). Phải nằm trong `QueryProvider`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Phiên kết thúc ở bất kỳ đâu (refresh 401, đăng xuất): bỏ user và dữ liệu riêng của người dùng.
  // Dữ liệu public (catalogue) giữ lại để vẫn xem offline.
  useEffect(
    () =>
      tokenStore.subscribe((signedIn) => {
        if (signedIn) return;
        setUser(null);
        setStatus('signedOut');
        queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
      }),
    [queryClient],
  );

  const restore = useCallback(async (isActive: () => boolean) => {
    setRestoreError(null);
    setStatus('restoring');
    try {
      if (!(await tokenStore.load())) {
        if (isActive()) setStatus('signedOut');
        return;
      }
      // Chưa có access token: /auth/me trả 401 → http-client tự refresh bằng token đã lưu rồi gửi lại.
      const me = await authApi.me();
      if (isActive()) {
        setUser(me);
        setStatus('signedIn');
      }
    } catch (error) {
      if (!isActive()) return;
      if (endsSession(error)) {
        await tokenStore.clear();
        setStatus('signedOut');
      } else {
        setRestoreError(toApiException(error).message);
        setStatus('unverified');
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void restore(() => active);
    return () => {
      active = false;
    };
  }, [restore]);

  const retryRestore = useCallback(() => restore(() => true), [restore]);

  const startSession = useCallback(
    async (result: LoginResult) => {
      queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
      await tokenStore.startSession(result);
      setUser(result.user);
      setRestoreError(null);
      setStatus('signedIn');
    },
    [queryClient],
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      const outcome = await authApi.login(payload);
      if ('mfaRequired' in outcome) return { mfaToken: outcome.mfaToken };
      await startSession(outcome);
      return null;
    },
    [startSession],
  );

  const completeTwoFactor = useCallback(
    async (mfaToken: string, code: TwoFactorCode) => {
      await startSession(await authApi.loginTwoFactor(mfaToken, code));
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    // Refresh đang chạy sẽ xoay vòng token: đợi để thu hồi đúng token mới nhất.
    await http.waitForRefresh();
    const refreshToken = tokenStore.getRefreshToken();
    await tokenStore.clear();
    if (refreshToken) {
      // Mất mạng thì phiên trên server tự hết hạn; thiết bị đã sạch token là đủ.
      await authApi.logout(refreshToken).catch(() => undefined);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, restoreError, retryRestore, login, completeTwoFactor, logout }),
    [user, status, restoreError, retryRestore, login, completeTwoFactor, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return value;
}
