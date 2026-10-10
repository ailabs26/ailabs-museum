import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '@/services/auth.service';
import { tokenStore } from './token-store';
import type { AuthUser, LoginPayload } from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Khôi phục phiên: nếu có refresh cookie, /auth/me sẽ trả user (qua auto-refresh ở http-client).
  useEffect(() => {
    let active = true;
    authService
      .me()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setIsLoading(false));
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
    try {
      await authService.logout();
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
      isLoading,
      login,
      logout,
      hasPermission: (permission) => granted.has(permission),
      hasAnyPermission: (permissions) => permissions.some((p) => granted.has(p)),
    };
  }, [user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
