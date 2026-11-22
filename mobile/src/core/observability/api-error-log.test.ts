import { ApiException } from '@/core/api/api-error';
import { ApiErrorLog, normalizeEndpoint, toApiErrorRecord, type ApiErrorRecord } from './api-error-log';

const rec = (endpoint: string, status: number, at: number): ApiErrorRecord => ({
  at,
  method: 'GET',
  endpoint,
  status,
  code: null,
  message: 'x',
  durationMs: null,
  requestId: null,
});

describe('normalizeEndpoint', () => {
  it('bỏ origin, query, hash và gom id thành :id', () => {
    expect(normalizeEndpoint('/rooms/3f2c9d1e-1b2a-4c3d-8e9f-0a1b2c3d4e5f?lang=vi#x')).toBe('/rooms/:id');
    expect(normalizeEndpoint('https://api.example/api/exhibits/42/media')).toBe('/api/exhibits/:id/media');
    expect(normalizeEndpoint('auth/me')).toBe('/auth/me');
    expect(normalizeEndpoint(undefined)).toBe('/');
  });
});

describe('ApiErrorLog', () => {
  it('giữ tối đa `capacity` bản ghi gần nhất, mới nhất trước', () => {
    const log = new ApiErrorLog(3);
    [1, 2, 3, 4].forEach((at) => log.record(rec('/rooms', 500, at)));
    expect(log.getRecent().map((r) => r.at)).toEqual([4, 3, 2]);
  });

  it('tổng hợp theo method + endpoint + status, nhiều nhất trước', () => {
    const log = new ApiErrorLog();
    log.record(rec('/rooms/:id', 503, 1));
    log.record(rec('/rooms/:id', 503, 5));
    log.record(rec('/auth/me', 401, 3));
    expect(log.getSummary()).toEqual([
      { method: 'GET', endpoint: '/rooms/:id', status: 503, count: 2, lastAt: 5 },
      { method: 'GET', endpoint: '/auth/me', status: 401, count: 1, lastAt: 3 },
    ]);
  });

  it('sink lỗi không làm hỏng việc ghi; gỡ sink được', () => {
    const log = new ApiErrorLog();
    const good = jest.fn();
    log.addSink(() => {
      throw new Error('sentry chưa sẵn sàng');
    });
    const remove = log.addSink(good);
    log.record(rec('/rooms', 500, 1));
    remove();
    log.record(rec('/rooms', 500, 2));
    expect(good).toHaveBeenCalledTimes(1);
    expect(log.getRecent()).toHaveLength(2);
  });

  it('toApiErrorRecord lấy mã lỗi đầu tiên và thời lượng', () => {
    const error = new ApiException('Dữ liệu không hợp lệ', 400, [{ code: 'required', field: 'reason', message: 'Bắt buộc' }]);
    expect(toApiErrorRecord({ method: 'post', url: '/reports?x=1', startedAt: 100, requestId: 'req-1' }, error, 350)).toEqual({
      at: 350,
      method: 'POST',
      endpoint: '/reports',
      status: 400,
      code: 'required',
      message: 'Dữ liệu không hợp lệ',
      durationMs: 250,
      requestId: 'req-1',
    });
  });
});
