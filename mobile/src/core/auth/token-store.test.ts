import * as SecureStore from 'expo-secure-store';
import { REFRESH_TOKEN_KEY, tokenStore } from './token-store';

jest.mock('expo-secure-store', () => jest.requireActual('./secure-store-mock').secureStoreMock());

const store = SecureStore as unknown as { __data: Map<string, string> };

describe('tokenStore', () => {
  beforeEach(async () => {
    await tokenStore.clear();
    store.__data.clear();
  });

  it('startSession giữ access token trong bộ nhớ, chỉ lưu refresh token vào SecureStore', async () => {
    await tokenStore.startSession({ accessToken: 'acc', refreshToken: 'rt' });
    expect(tokenStore.getAccessToken()).toBe('acc');
    expect(tokenStore.hasSession()).toBe(true);
    expect([...store.__data.entries()]).toEqual([[REFRESH_TOKEN_KEY, 'rt']]);
  });

  it('load khôi phục refresh token đã lưu (mở lại app)', async () => {
    store.__data.set(REFRESH_TOKEN_KEY, 'saved-rt');
    await expect(tokenStore.load()).resolves.toBe(true);
    expect(tokenStore.getRefreshToken()).toBe('saved-rt');
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('load không có gì -> false', async () => {
    await expect(tokenStore.load()).resolves.toBe(false);
  });

  it('rotate giữ nguyên phiên; startSession/clear đổi phiên', async () => {
    await tokenStore.startSession({ accessToken: 'a1', refreshToken: 'r1' });
    const session = tokenStore.getSessionId();
    await tokenStore.rotate({ accessToken: 'a2', refreshToken: 'r2' });
    expect(tokenStore.getSessionId()).toBe(session);
    expect(store.__data.get(REFRESH_TOKEN_KEY)).toBe('r2');
    await tokenStore.clear();
    expect(tokenStore.getSessionId()).not.toBe(session);
  });

  it('clear xóa sạch bộ nhớ lẫn SecureStore và báo đăng xuất một lần', async () => {
    const listener = jest.fn();
    const unsubscribe = tokenStore.subscribe(listener);
    await tokenStore.startSession({ accessToken: 'acc', refreshToken: 'rt' });
    await tokenStore.clear();
    await tokenStore.clear();
    unsubscribe();
    expect(listener.mock.calls).toEqual([[true], [false]]);
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.hasSession()).toBe(false);
    expect(store.__data.size).toBe(0);
  });
});
