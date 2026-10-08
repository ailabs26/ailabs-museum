/**
 * Lưu access token trong bộ nhớ (an toàn hơn localStorage trước XSS).
 * Refresh token do server giữ qua httpOnly cookie (xem 05-security-rbac.md).
 * Có listener để AuthContext đồng bộ trạng thái khi token đổi.
 */
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  set(token: string | null): void {
    accessToken = token;
    listeners.forEach((fn) => fn(token));
  },
  clear(): void {
    this.set(null);
  },
  subscribe(fn: (token: string | null) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
