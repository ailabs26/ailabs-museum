import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { USER, installFakeApi, type FakeRoute } from './test-utils';
import { REFRESH_TOKEN_KEY, tokenStore } from './token-store';

jest.mock('expo-secure-store', () => jest.requireActual('./secure-store-mock').secureStoreMock());

const store = SecureStore as unknown as { __data: Map<string, string> };

function renderAuth(route: FakeRoute) {
  const sent = installFakeApi(route);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { sent, queryClient, ...renderHook(() => useAuth(), { wrapper }) };
}

/** Back-end giả: /auth/me cần token `valid`; refresh nhận `rt-1`; login trả phiên mới. */
const api: FakeRoute = (config) => {
  switch (config.url) {
    case '/auth/me':
      return config.headers.Authorization === 'Bearer valid' ? { status: 200, data: USER } : { status: 401 };
    case '/auth/refresh': {
      const body = JSON.parse(config.data as string) as { refreshToken?: string };
      return body.refreshToken === 'rt-1'
        ? { status: 200, data: { accessToken: 'valid', refreshToken: 'rt-2' } }
        : { status: 401 };
    }
    case '/auth/login':
      return { status: 200, data: { accessToken: 'valid', refreshToken: 'rt-login', user: USER } };
    case '/auth/logout':
      return { status: 200, data: null };
    default:
      return { status: 404 };
  }
};

describe('AuthProvider', () => {
  beforeEach(async () => {
    await tokenStore.clear();
    store.__data.clear();
  });

  it('chưa từng đăng nhập -> signedOut, không gọi API', async () => {
    const { result, sent } = renderAuth(api);
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(sent).toEqual([]);
  });

  it('mở lại app có refresh token đã lưu -> tự refresh rồi lấy user', async () => {
    store.__data.set(REFRESH_TOKEN_KEY, 'rt-1');
    const { result, sent } = renderAuth(api);
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.user).toEqual(USER);
    expect(sent.map((r) => r.url)).toEqual(['/auth/me', '/auth/refresh', '/auth/me']);
    expect(store.__data.get(REFRESH_TOKEN_KEY)).toBe('rt-2');
  });

  it('refresh token đã bị thu hồi -> signedOut và xóa khỏi SecureStore', async () => {
    store.__data.set(REFRESH_TOKEN_KEY, 'revoked');
    const { result } = renderAuth(api);
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(store.__data.size).toBe(0);
  });

  it('mở app khi mất mạng -> unverified, giữ phiên, thử lại được', async () => {
    store.__data.set(REFRESH_TOKEN_KEY, 'rt-1');
    let online = false;
    const { result } = renderAuth((config) => (online ? api(config) : 'network-error'));
    await waitFor(() => expect(result.current.status).toBe('unverified'));
    expect(result.current.restoreError).toBe('Không kết nối được máy chủ');
    expect(store.__data.get(REFRESH_TOKEN_KEY)).toBe('rt-1');

    online = true;
    await act(() => result.current.retryRestore());
    expect(result.current.status).toBe('signedIn');
  });

  it('login lưu phiên; logout xóa token, dữ liệu riêng và thu hồi trên server', async () => {
    const { result, sent, queryClient } = renderAuth(api);
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await expect(result.current.login({ email: USER.email, password: 'Passw0rd!' })).resolves.toBeNull();
    });
    expect(result.current.status).toBe('signedIn');
    expect(store.__data.get(REFRESH_TOKEN_KEY)).toBe('rt-login');

    queryClient.setQueryData(['session', 'reports'], [{ id: 'r1' }]);
    queryClient.setQueryData(['rooms'], [{ slug: 'phong-1' }]);

    await act(() => result.current.logout());
    expect(result.current).toMatchObject({ status: 'signedOut', user: null });
    expect(store.__data.size).toBe(0);
    expect(sent.at(-1)).toMatchObject({ url: '/auth/logout', client: 'mobile', body: { refreshToken: 'rt-login' } });
    expect(queryClient.getQueryData(['session', 'reports'])).toBeUndefined();
    expect(queryClient.getQueryData(['rooms'])).toEqual([{ slug: 'phong-1' }]);
  });

  it('logout khi mất mạng vẫn xóa sạch token trên máy', async () => {
    let online = true;
    const { result } = renderAuth((config) => (online ? api(config) : 'network-error'));
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await act(() => result.current.login({ email: USER.email, password: 'Passw0rd!' }).then(() => undefined));

    online = false;
    await act(() => result.current.logout());
    expect(result.current.status).toBe('signedOut');
    expect(store.__data.size).toBe(0);
  });

  it('tài khoản bật 2FA -> trả mfaToken, hoàn tất bằng mã 6 số', async () => {
    const { result, sent } = renderAuth((config) => {
      if (config.url === '/auth/login') return { status: 200, data: { mfaRequired: true, mfaToken: 'mfa-1' } };
      if (config.url === '/auth/login/2fa')
        return { status: 200, data: { accessToken: 'valid', refreshToken: 'rt-2fa', user: USER } };
      return api(config);
    });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    let challenge: { mfaToken: string } | null = null;
    await act(async () => {
      challenge = await result.current.login({ email: USER.email, password: 'Passw0rd!' });
    });
    expect(challenge).toEqual({ mfaToken: 'mfa-1' });
    expect(result.current.status).toBe('signedOut');

    await act(() => result.current.completeTwoFactor('mfa-1', { code: '123456' }));
    expect(result.current.status).toBe('signedIn');
    expect(sent.at(-1)).toMatchObject({ url: '/auth/login/2fa', client: 'mobile', body: { mfaToken: 'mfa-1', code: '123456' } });
    expect(store.__data.get(REFRESH_TOKEN_KEY)).toBe('rt-2fa');
  });
});
