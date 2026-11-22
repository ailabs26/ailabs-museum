import { AxiosError, CanceledError, type AxiosAdapter } from 'axios';
import { tokenStore } from '@/core/auth/token-store';
import { apiErrorLog } from '@/core/observability/api-error-log';
import { http } from './http-client';

jest.mock('expo-secure-store', () => jest.requireActual('@/core/auth/secure-store-mock').secureStoreMock());

type Reply = { status: number; data?: unknown; requestId?: string } | 'network' | 'cancel';

/** Adapter giả theo URL; mọi phản hồi lỗi mang `X-Request-Id`. */
function fakeApi(route: (url: string, auth?: string) => Reply) {
  const adapter: AxiosAdapter = async (config) => {
    const reply = route(config.url ?? '', config.headers.Authorization as string | undefined);
    if (reply === 'network') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    if (reply === 'cancel') throw new CanceledError(undefined, undefined, config);
    const ok = reply.status < 400;
    const response = {
      status: reply.status,
      statusText: '',
      data: ok ? { success: true, data: reply.data ?? null, message: null } : { success: false, data: null, message: `Lỗi ${reply.status}` },
      headers: { 'x-request-id': reply.requestId ?? 'req-1' },
      config,
    };
    if (!ok) throw new AxiosError(`HTTP ${reply.status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
    return response;
  };
  http.raw.defaults.adapter = adapter;
}

describe('http-client ghi log lỗi API tập trung', () => {
  beforeEach(async () => {
    apiErrorLog.clear();
    await tokenStore.clear();
  });

  it('ghi method, endpoint đã chuẩn hóa, status, request id', async () => {
    fakeApi(() => ({ status: 503, requestId: 'req-503' }));
    await expect(http.get('/rooms/3f2c9d1e-1b2a-4c3d-8e9f-0a1b2c3d4e5f?lang=vi')).rejects.toMatchObject({ status: 503 });
    expect(apiErrorLog.getRecent()).toEqual([
      expect.objectContaining({ method: 'GET', endpoint: '/rooms/:id', status: 503, message: 'Lỗi 503', requestId: 'req-503' }),
    ]);
  });

  it('mất mạng ghi status 0; request bị hủy không ghi', async () => {
    fakeApi(() => 'network');
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 0 });
    fakeApi(() => 'cancel');
    await expect(http.get('/rooms')).rejects.toMatchObject({ isCanceled: true });
    expect(apiErrorLog.getRecent().map((r) => r.status)).toEqual([0]);
  });

  it('401 được refresh xử lý êm -> không ghi lỗi', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    fakeApi((url, auth) => {
      if (url === '/auth/refresh') return { status: 200, data: { accessToken: 'valid', refreshToken: 'rt-2' } };
      return auth === 'Bearer valid' ? { status: 200, data: [] } : { status: 401 };
    });
    await http.get('/rooms');
    expect(apiErrorLog.getRecent()).toEqual([]);
  });

  it('refresh thất bại -> chỉ ghi một bản ghi (lỗi refresh), không ghi trùng ở request gốc', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'revoked' });
    fakeApi((url) => (url === '/auth/refresh' ? { status: 401 } : { status: 401 }));
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 401 });
    expect(apiErrorLog.getRecent().map((r) => `${r.method} ${r.endpoint} ${r.status}`)).toEqual(['POST /auth/refresh 401']);
  });

  it('không lưu token, body hay query vào log', async () => {
    await tokenStore.startSession({ accessToken: 'secret-access', refreshToken: 'secret-refresh' });
    fakeApi(() => ({ status: 400 }));
    await expect(http.post('/reports?email=a@b.c', { note: 'nội dung riêng tư' })).rejects.toMatchObject({ status: 400 });
    const dump = JSON.stringify(apiErrorLog.getRecent());
    for (const secret of ['secret-access', 'secret-refresh', 'nội dung riêng tư', 'a@b.c', 'Bearer']) {
      expect(dump).not.toContain(secret);
    }
  });
});
