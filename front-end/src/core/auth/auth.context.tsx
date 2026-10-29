import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { endsSession, toApiException } from '@/core/api/api-error';
import { authService } from '@/services/auth.service';
import { tokenStore } from './token-store';
import { clearSessionCache } from './clearSessionCache';
import type { AuthUser, LoginPayload } from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Khôi phục phiên khi tải trang gặp lỗi tạm thời (429/5xx/mất mạng): phiên có thể vẫn còn, không coi là
   * đã đăng xuất. null khi không có lỗi.
   */
  restoreError: string | null;
  /** Thử khôi phục phiên lại sau lỗi tạm thời. */
  retryRestore: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  /** Đăng xuất mọi thiết bị (kể cả thiết bị này) rồi kết thúc phiên cục bộ. */
  logoutAll: () => Promise<void>;
  /** Tự đổi tên hiển thị; cập nhật user trong context để header đổi ngay. */
  updateProfile: (input: { displayName: string }) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const initialSession = useRef<Promise<AuthUser> | null>(null);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    let hadSession = tokenStore.get() !== null;
    return tokenStore.subscribe((token) => {
      if (token === null) {
        setUser(null);
        // Failed anonymous bootstrap must not restart published room requests.
        // Ending an existing session still cancels and removes every query.
        clearSessionCache(queryClient, !hadSession);
      }
      hadSession = token !== null;
    });
  }, [queryClient]);

  /**
   * Khôi phục phiên: nếu có refresh cookie, /auth/me sẽ trả user (qua auto-refresh ở http-client).
   * 401 = không còn phiên → đăng xuất; lỗi tạm thời → giữ nguyên, báo lỗi để người dùng thử lại.
   */
  const restoreSession = useCallback((request: Promise<AuthUser>, isActive: () => boolean) => {
    request
      .then((restoredUser) => {
        if (isActive() && tokenStore.get() !== null) {
          setUser(restoredUser);
        }
      })
      .catch((error: unknown) => {
        if (!isActive()) return;
        if (endsSession(error)) tokenStore.clear();
        else setRestoreError(toApiException(error).message);
      })
      .finally(() => {
        if (isActive()) {
          setIsLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    let active = true;
    // Dùng lại request khi StrictMode chạy lại effect trong môi trường dev.
    initialSession.current ??= authService.me();
    restoreSession(initialSession.current, () => active);
    return () => {
      active = false;
    };
  }, [restoreSession]);

  const retryRestore = useCallback(() => {
    setRestoreError(null);
    setIsLoading(true);
    restoreSession(authService.me(), () => true);
  }, [restoreSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await authService.login(payload);
    tokenStore.set(result.accessToken);
    setRestoreError(null);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) {
      return;
    }

    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    tokenStore.clear();
    setUser(null);

    try {
      await authService.logout();
    } finally {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    // Gọi API trước khi xóa token: endpoint cần access token còn hiệu lực.
    try {
      await authService.logoutAll();
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (input: { displayName: string }) => {
    setUser(await authService.updateProfile(input));
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const granted = new Set(user?.permissions ?? []);
    return {
      user,
      isAuthenticated: !!user,
      isLoading: isLoading || isLoggingOut,
      restoreError,
      retryRestore,
      login,
      logout,
      logoutAll,
      updateProfile,
      hasPermission: (permission) => granted.has(permission),
      hasAnyPermission: (permissions) => permissions.some((p) => granted.has(p)),
    };
  }, [user, isLoading, isLoggingOut, restoreError, retryRestore, login, logout, logoutAll, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
