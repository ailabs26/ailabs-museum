import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { tokenStore } from './token-store';
import { clearSessionCache } from './clearSessionCache';
import type { AuthUser, LoginPayload } from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  /** Đăng xuất mọi thiết bị (kể cả thiết bị này) rồi kết thúc phiên cục bộ. */
  logoutAll: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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

  // Khôi phục phiên: nếu có refresh cookie, /auth/me sẽ trả user (qua auto-refresh ở http-client).
  useEffect(() => {
    let active = true;
    // Dùng lại request khi StrictMode chạy lại effect trong môi trường dev.
    initialSession.current ??= authService.me();
    initialSession.current
      .then((restoredUser) => {
        if (active && tokenStore.get() !== null) {
          setUser(restoredUser);
        }
      })
      .catch(() => {
        if (active) {
          tokenStore.clear();
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await authService.login(payload);
    tokenStore.set(result.accessToken);
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

  const value = useMemo<AuthContextValue>(() => {
    const granted = new Set(user?.permissions ?? []);
    return {
      user,
      isAuthenticated: !!user,
      isLoading: isLoading || isLoggingOut,
      login,
      logout,
      logoutAll,
      hasPermission: (permission) => granted.has(permission),
      hasAnyPermission: (permissions) => permissions.some((p) => granted.has(p)),
    };
  }, [user, isLoading, isLoggingOut, login, logout, logoutAll]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
