import { tokenStore } from '@/core/auth/token-store';
import { installFakeApi } from '@/core/auth/test-utils';
import { ApiException } from './api-error';
import { http } from './http-client';

jest.mock('expo-secure-store', () => jest.requireActual('@/core/auth/secure-store-mock').secureStoreMock());

/** API giả: `/rooms` chỉ nhận token `valid`; `/auth/refresh` trả theo `refreshReply`. */
function fakeApi(refreshReply: () => { status: number; data?: unknown } | 'network-error') {
  return installFakeApi((config) => {
    if (config.url === '/auth/refresh') return refreshReply();
    return config.headers.Authorization === 'Bearer valid'
      ? { status: 200, data: [{ slug: 'phong-1' }] }
      : { status: 401, data: 'Token hết hạn' };
  });
}

const rotated = () => ({ status: 200, data: { accessToken: 'valid', refreshToken: 'rt-2' } });

describe('http-client — Bearer + tự làm mới khi 401', () => {
  beforeEach(async () => {
    await tokenStore.clear();
  });

  it('gắn Bearer khi có access token', async () => {
    await tokenStore.startSession({ accessToken: 'valid', refreshToken: 'rt-1' });
    const sent = fakeApi(rotated);
    await http.get('/rooms');
    expect(sent.map((r) => r.authorization)).toEqual(['Bearer valid']);
  });

  it('401 -> refresh bằng token trong body + X-Client -> lưu token mới -> gửi lại', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    const sent = fakeApi(rotated);
    await expect(http.get('/rooms')).resolves.toEqual([{ slug: 'phong-1' }]);
    expect(sent.map((r) => r.url)).toEqual(['/rooms', '/auth/refresh', '/rooms']);
    expect(sent[1]).toMatchObject({ client: 'mobile', authorization: undefined, body: { refreshToken: 'rt-1' } });
    expect(tokenStore.getRefreshToken()).toBe('rt-2');
  });

  it('nhiều request 401 đồng thời chỉ refresh một lần', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    const sent = fakeApi(rotated);
    await Promise.all([http.get('/rooms'), http.get('/rooms'), http.get('/rooms')]);
    expect(sent.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
  });

  it('refresh 401 -> kết thúc phiên, request báo 401', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'revoked' });
    fakeApi(() => ({ status: 401, data: 'Phiên không hợp lệ' }));
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.hasSession()).toBe(false);
  });

  it('refresh lỗi tạm thời (503, mất mạng) -> giữ phiên để thử lại sau', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    fakeApi(() => ({ status: 503 }));
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 503 });
    fakeApi(() => 'network-error');
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 0 });
    expect(tokenStore.getRefreshToken()).toBe('rt-1');
  });

  it('refresh trả dữ liệu sai hợp đồng -> 502, giữ phiên', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    fakeApi(() => ({ status: 200, data: { accessToken: 'valid' } }));
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 502 });
    expect(tokenStore.hasSession()).toBe(true);
  });

  it('vừa làm mới mà vẫn 401 -> kết thúc phiên, không lặp refresh', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    const sent = fakeApi(() => ({ status: 200, data: { accessToken: 'still-bad', refreshToken: 'rt-2' } }));
    await expect(http.get('/rooms')).rejects.toBeInstanceOf(ApiException);
    expect(sent.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
    expect(tokenStore.hasSession()).toBe(false);
  });

  it('không có phiên -> 401 trả thẳng, không gọi refresh', async () => {
    const sent = fakeApi(rotated);
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 401 });
    expect(sent.map((r) => r.url)).toEqual(['/rooms']);
  });

  it('401 của endpoint auth không kích hoạt refresh', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    const sent = installFakeApi(() => ({ status: 401, data: 'Sai mật khẩu' }));
    await expect(http.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(sent.map((r) => r.url)).toEqual(['/auth/login']);
    expect(tokenStore.hasSession()).toBe(true);
  });

  it('đăng xuất trong lúc refresh đang chạy -> bỏ token trả về, không khôi phục phiên', async () => {
    await tokenStore.startSession({ accessToken: 'expired', refreshToken: 'rt-1' });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    installFakeApi((config) => (config.url === '/auth/refresh' ? rotated() : { status: 401 }));
    // Chặn adapter ở request refresh cho tới khi đã đăng xuất.
    const adapter = http.raw.defaults.adapter as (c: unknown) => Promise<unknown>;
    http.raw.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') await gate;
      return adapter(config) as never;
    };
    const pending = http.get('/rooms');
    await tokenStore.clear();
    release();
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.hasSession()).toBe(false);
    expect(tokenStore.getAccessToken()).toBeNull();
  });
});
