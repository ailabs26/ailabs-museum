import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tokenStore } from '@/core/auth/token-store';
import { ApiException, endsSession } from './api-error';
import { http } from './http-client';

type Reply = { status: number; data?: unknown; headers?: Record<string, string> } | 'network-error';

/**
 * Adapter giả cho cả axios instance của http-client lẫn axios mặc định (refresh dùng axios.post):
 * `/users` trả 401 khi token cũ, `/auth/refresh` trả lần lượt theo `refreshReplies`.
 */
function installAdapter(refreshReplies: Reply[]) {
  const calls: string[] = [];
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    calls.push(url.replace(/^.*\/api/, ''));
    const reply: Reply = url.endsWith('/auth/refresh')
      ? refreshReplies.shift() ?? { status: 500 }
      : config.headers.Authorization === 'Bearer fresh-token'
        ? { status: 200, data: { success: true, data: [{ id: 'u1' }], message: null } }
        : { status: 401, data: { success: false, data: null, message: 'Token hết hạn' } };
    if (reply === 'network-error') {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    }
    const response = { status: reply.status, statusText: '', data: reply.data ?? { success: false, data: null, message: 'Lỗi' }, headers: reply.headers ?? {}, config };
    if (reply.status >= 400) throw new AxiosError(`HTTP ${reply.status}`, 'ERR_BAD_RESPONSE', config, null, response);
    return response;
  };
  http.raw.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  return calls;
}

const refreshOk = { status: 200, data: { success: true, data: { accessToken: 'fresh-token' }, message: null } };

describe('http-client — refresh thất bại (issue #128)', () => {
  const originalAdapter = axios.defaults.adapter;

  beforeEach(() => {
    tokenStore.set('old-token');
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    http.raw.defaults.adapter = originalAdapter;
    tokenStore.clear();
  });

  it('refresh 401 (phiên hết hạn / bị thu hồi) → kết thúc phiên', async () => {
    installAdapter([{ status: 401, data: { success: false, data: null, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' } }]);
    await expect(http.get('/users')).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.get()).toBeNull();
    expect(tokenStore.canRefresh()).toBe(false);
  });

  it('refresh 429 → giữ phiên, báo số giây chờ theo Retry-After; lần sau refresh được thì dùng tiếp', async () => {
    const calls = installAdapter([
      { status: 429, data: { success: false, data: null, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' }, headers: { 'retry-after': '12' } },
      refreshOk,
    ]);
    const error = await http.get('/users').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({ status: 429, message: 'Làm mới phiên quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau 12 giây.' });
    expect(tokenStore.get()).toBe('old-token');
    expect(tokenStore.canRefresh()).toBe(true);

    await expect(http.get('/users')).resolves.toEqual([{ id: 'u1' }]);
    expect(tokenStore.get()).toBe('fresh-token');
    expect(calls.filter((url) => url === '/auth/refresh')).toHaveLength(2);
  });

  it('refresh 429 không có Retry-After → thông điệp chung', async () => {
    installAdapter([{ status: 429 }]);
    await expect(http.get('/users')).rejects.toMatchObject({
      status: 429, message: 'Làm mới phiên quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau ít phút.',
    });
    expect(tokenStore.get()).toBe('old-token');
  });

  it('refresh 500 → giữ phiên', async () => {
    installAdapter([{ status: 500, data: { success: false, data: null, message: 'Lỗi hệ thống không mong muốn' } }]);
    await expect(http.get('/users')).rejects.toMatchObject({ status: 500 });
    expect(tokenStore.get()).toBe('old-token');
    expect(tokenStore.canRefresh()).toBe(true);
  });

  it('mất mạng khi refresh → giữ phiên', async () => {
    installAdapter(['network-error']);
    await expect(http.get('/users')).rejects.toMatchObject({ status: 0, message: 'Không kết nối được máy chủ' });
    expect(tokenStore.get()).toBe('old-token');
  });
});

describe('endsSession', () => {
  it('chỉ 401 kết thúc phiên', () => {
    expect(endsSession(new ApiException('x', 401))).toBe(true);
    for (const status of [0, 403, 429, 500, 502, 503]) {
      expect(endsSession(new ApiException('x', status))).toBe(false);
    }
  });
});
