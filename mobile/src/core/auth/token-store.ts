import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SessionTokens } from './auth-schema';

/**
 * Kho token (MOB-E3-03).
 * - Access token chỉ nằm trong bộ nhớ (ngắn hạn, mất khi tắt app là đúng).
 * - Refresh token nằm trong bộ nhớ + `expo-secure-store` (Keychain / Android Keystore) để khôi phục phiên.
 * - `sessionId` tăng mỗi lần bắt đầu/kết thúc phiên; xoay vòng token giữ nguyên `sessionId`,
 *   để request/refresh đang bay của phiên cũ không ghi đè phiên mới.
 *
 * Web (Expo web, chỉ dùng khi dev) không có SecureStore → chỉ giữ trong bộ nhớ.
 */
export const REFRESH_TOKEN_KEY = 'aura.refresh-token';

const persistent = Platform.OS !== 'web';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionId = 0;
const listeners = new Set<(signedIn: boolean) => void>();

function notify(): void {
  const signedIn = refreshToken !== null;
  listeners.forEach((fn) => fn(signedIn));
}

async function persist(token: string | null): Promise<void> {
  if (!persistent) return;
  if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },
  getRefreshToken(): string | null {
    return refreshToken;
  },
  getSessionId(): number {
    return sessionId;
  },
  /** Có phiên (refresh token) để làm mới access token hay không. */
  hasSession(): boolean {
    return refreshToken !== null;
  },

  /** Đọc refresh token đã lưu khi mở app; trả true nếu có phiên để khôi phục. */
  async load(): Promise<boolean> {
    if (persistent && refreshToken === null) {
      refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
    return refreshToken !== null;
  },

  /** Đăng nhập thành công: phiên mới. */
  async startSession(tokens: SessionTokens): Promise<void> {
    sessionId += 1;
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    notify();
    await persist(tokens.refreshToken);
  },

  /** Xoay vòng token trong cùng phiên (sau /auth/refresh). */
  async rotate(tokens: SessionTokens): Promise<void> {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    await persist(tokens.refreshToken);
  },

  /** Kết thúc phiên: xóa cả bộ nhớ lẫn SecureStore. */
  async clear(): Promise<void> {
    const hadSession = refreshToken !== null || accessToken !== null;
    sessionId += 1;
    accessToken = null;
    refreshToken = null;
    if (hadSession) notify();
    await persist(null);
  },

  /** Lắng nghe đăng nhập/đăng xuất (không gọi khi chỉ xoay vòng token). */
  subscribe(fn: (signedIn: boolean) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
