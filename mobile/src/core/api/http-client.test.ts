import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { ApiException, endsSession, toApiException } from './api-error';
import { http, REQUEST_TIMEOUT_MS } from './http-client';

type Reply =
  | { status: number; data?: unknown }
  | { fail: 'network' | 'timeout' };

/** Adapter giả: trả lần lượt theo `replies`, ghi lại request để kiểm. */
function installAdapter(...replies: Reply[]) {
  const requests: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    requests.push(config);
    const reply = replies.shift() ?? { status: 500 };
    if ('fail' in reply) {
      throw reply.fail === 'timeout'
        ? new AxiosError('timeout exceeded', AxiosError.ECONNABORTED, config)
        : new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response = { status: reply.status, statusText: '', data: reply.data, headers: {}, config };
    if (reply.status >= 400) {
      throw new AxiosError(`Request failed with status code ${reply.status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
    }
    return response;
  };
  http.raw.defaults.adapter = adapter;
  return requests;
}

const ok = (data: unknown, meta?: unknown) => ({ status: 200, data: { success: true, data, message: null, meta } });

describe('http-client', () => {
  it('dùng base URL, timeout và Accept JSON', async () => {
    const requests = installAdapter(ok({ id: 'r1' }));
    await http.get('/rooms/r1');
    expect(requests[0]?.baseURL).toBe('http://localhost:3000/api');
    expect(requests[0]?.timeout).toBe(REQUEST_TIMEOUT_MS);
    expect(requests[0]?.headers.Accept).toBe('application/json');
  });

  it('bóc envelope trả thẳng data', async () => {
    installAdapter(ok({ id: 'r1', name: 'Phòng 1' }));
    await expect(http.get('/rooms/r1')).resolves.toEqual({ id: 'r1', name: 'Phòng 1' });
  });

  it('getPage gộp data + meta', async () => {
    installAdapter(ok([{ id: 'a' }], { page: 2, pageSize: 1, total: 5 }));
    await expect(http.getPage('/rooms')).resolves.toEqual({ items: [{ id: 'a' }], page: 2, pageSize: 1, total: 5 });
  });

  it('getPage thiếu meta coi cả danh sách là một trang; data null thành mảng rỗng', async () => {
    installAdapter(ok([{ id: 'a' }, { id: 'b' }]), ok(null));
    await expect(http.getPage('/rooms')).resolves.toEqual({ items: [{ id: 'a' }, { id: 'b' }], page: 1, pageSize: 2, total: 2 });
    await expect(http.getPage('/rooms')).resolves.toEqual({ items: [], page: 1, pageSize: 0, total: 0 });
  });

  it('gửi body cho post/patch/put', async () => {
    const requests = installAdapter(ok({ id: 'x' }), ok({ id: 'x' }), ok({ id: 'x' }));
    await http.post('/reports', { reason: 'sai' });
    await http.patch('/reports/x', { reason: 'đúng' });
    await http.put('/reports/x', { reason: 'mới' });
    expect(requests.map((r) => [r.method, JSON.parse(r.data as string)])).toEqual([
      ['post', { reason: 'sai' }],
      ['patch', { reason: 'đúng' }],
      ['put', { reason: 'mới' }],
    ]);
  });

  it('lỗi có envelope -> ApiException mang message, status, lỗi theo field', async () => {
    installAdapter({
      status: 400,
      data: { success: false, data: null, message: 'Dữ liệu không hợp lệ', errors: [{ field: 'reason', code: 'required', message: 'Bắt buộc' }] },
    });
    const error = await http.post('/reports', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({ message: 'Dữ liệu không hợp lệ', status: 400 });
    expect((error as ApiException).fieldErrors).toEqual({ reason: 'Bắt buộc' });
  });

  it('lỗi không có envelope (vd 502 từ proxy) giữ status', async () => {
    installAdapter({ status: 502, data: '<html>Bad Gateway</html>' });
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 502, isNetworkError: false });
  });

  it('mất mạng và timeout -> status 0 với thông điệp riêng', async () => {
    installAdapter({ fail: 'network' }, { fail: 'timeout' });
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 0, isNetworkError: true, message: 'Không kết nối được máy chủ' });
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 0, message: 'Máy chủ phản hồi quá lâu' });
  });
});

describe('toApiException / endsSession', () => {
  it('giữ nguyên ApiException và bọc Error thường', () => {
    const original = new ApiException('x', 403);
    expect(toApiException(original)).toBe(original);
    expect(toApiException(new Error('hỏng'))).toMatchObject({ message: 'hỏng', status: 0 });
  });

  it('chỉ 401 mới kết thúc phiên', () => {
    expect(endsSession(new ApiException('hết hạn', 401))).toBe(true);
    expect(endsSession(new ApiException('quá tải', 429))).toBe(false);
    expect(endsSession(new ApiException('mất mạng', 0))).toBe(false);
  });
});
