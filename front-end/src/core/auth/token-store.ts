/**
 * Lưu access token trong bộ nhớ (an toàn hơn localStorage trước XSS).
 * Refresh token do server giữ qua httpOnly cookie (xem 05-security-rbac.md).
 * Có listener để AuthContext đồng bộ trạng thái khi token đổi.
 */
let accessToken: string | null = null;
let version = 0;
let sessionVersion = 0;
let canRefresh = true;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  getVersion(): number {
    return version;
  },
  getSessionVersion(): number {
    return sessionVersion;
  },
  canRefresh(): boolean {
    return canRefresh;
  },
  set(token: string | null): void {
    sessionVersion += 1;
    this.replace(token);
  },
  /** Rotation đổi access token nhưng vẫn thuộc cùng phiên đăng nhập. */
  replace(token: string | null): void {
    accessToken = token;
    version += 1;
    canRefresh = token !== null;
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
