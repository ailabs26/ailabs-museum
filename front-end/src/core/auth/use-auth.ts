import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './auth.context';

/** Hook truy cập trạng thái/hành động xác thực. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}
